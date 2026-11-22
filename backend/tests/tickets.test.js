const { app, request, resetDb, makeUser, bearer, pool } = require('./helpers');

let student, student2, tech, admin;
beforeAll(async () => {
  await resetDb();
  student = await makeUser('student');
  student2 = await makeUser('student', 'student2@test.com');
  tech = await makeUser('technician');
  admin = await makeUser('admin');
});
afterAll(() => pool.end());

const create = (u, body) => request(app).post('/tickets').set(bearer(u.token)).send(body);

describe('create and list tickets', () => {
  test('student creates a ticket (defaults applied)', async () => {
    const res = await create(student, { title: 'Fan not working', description: 'Room 101 fan is dead', category: 'Electrical' });
    expect(res.status).toBe(201);
    expect(res.body.ticket).toMatchObject({ status: 'Open', priority: 'Medium', requester_id: student.user.id });
  });

  test('only students can create; validation enforced; auth required', async () => {
    expect((await create(admin, { title: 'abc' })).status).toBe(403);
    expect((await create(student, { title: 'x' })).status).toBe(400);
    expect((await create(student, { title: 'Valid title', category: 'Magic' })).status).toBe(400);
    expect((await request(app).post('/tickets').send({ title: 'Valid title' })).status).toBe(401);
  });

  test('list is scoped by role', async () => {
    await create(student2, { title: 'Leaking tap', category: 'Plumbing', priority: 'High' });
    const mine = await request(app).get('/tickets').set(bearer(student.token));
    expect(mine.body.total).toBe(1);
    expect((await request(app).get('/tickets').set(bearer(admin.token))).body.total).toBe(2);
    expect((await request(app).get('/tickets').set(bearer(tech.token))).body.total).toBe(0);
  });

  test('filters, search and pagination', async () => {
    const t = (q) => request(app).get('/tickets').query(q).set(bearer(admin.token));
    expect((await t({ category: 'Plumbing' })).body.total).toBe(1);
    expect((await t({ priority: 'High' })).body.tickets[0].title).toBe('Leaking tap');
    expect((await t({ q: 'fan' })).body.total).toBe(1);
    const page = await t({ limit: 1, page: 2 });
    expect(page.body.tickets).toHaveLength(1);
    expect(page.body.total).toBe(2);
    expect((await t({ status: 'Bogus' })).status).toBe(400);
  });

  test('get by id respects scope', async () => {
    const list = await request(app).get('/tickets').set(bearer(student.token));
    const id = list.body.tickets[0].id;
    expect((await request(app).get(`/tickets/${id}`).set(bearer(student.token))).status).toBe(200);
    expect((await request(app).get(`/tickets/${id}`).set(bearer(student2.token))).status).toBe(404);
    expect((await request(app).get(`/tickets/${id}`).set(bearer(admin.token))).status).toBe(200);
  });
});

describe('assign and status', () => {
  let id;
  beforeAll(async () => { id = (await create(student, { title: 'Broken chair' })).body.ticket.id; });
  const patch = (u, path, body) => request(app).patch(`/tickets/${id}/${path}`).set(bearer(u.token)).send(body);

  test('only admin can assign, and only to a technician', async () => {
    expect((await patch(student, 'assign', { assignee_id: tech.user.id })).status).toBe(403);
    expect((await patch(admin, 'assign', { assignee_id: student.user.id })).status).toBe(400);
    const res = await patch(admin, 'assign', { assignee_id: tech.user.id });
    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatchObject({ status: 'Assigned', assignee_id: tech.user.id });
  });

  test('technician sees assigned ticket and drives it to Resolved', async () => {
    expect((await request(app).get('/tickets').set(bearer(tech.token))).body.total).toBe(1);
    expect((await patch(student, 'status', { status: 'In Progress' })).status).toBe(403);
    expect((await patch(tech, 'status', { status: 'Resolved' })).status).toBe(409);
    expect((await patch(tech, 'status', { status: 'In Progress' })).body.ticket.status).toBe('In Progress');
    const r = await patch(tech, 'status', { status: 'Resolved' });
    expect(r.body.ticket.status).toBe('Resolved');
    expect(r.body.ticket.resolved_at).toBeTruthy();
  });

  test('requester can reopen; other students and unassigned technicians cannot touch it', async () => {
    expect((await patch(student2, 'status', { status: 'Reopened' })).status).toBe(404);
    const re = await patch(student, 'status', { status: 'Reopened' });
    expect(re.body.ticket).toMatchObject({ status: 'Reopened', resolved_at: null });
    await patch(admin, 'assign', { assignee_id: tech.user.id });
    await patch(tech, 'status', { status: 'In Progress' });
    await patch(tech, 'status', { status: 'Resolved' });
    expect((await patch(student, 'status', { status: 'Closed' })).body.ticket.status).toBe('Closed');
    expect((await patch(admin, 'assign', { assignee_id: tech.user.id })).status).toBe(409);
    expect((await patch(admin, 'status', { status: 'Open' })).status).toBe(409);
  });
});

describe('history events', () => {
  test('every change is logged with actor, old and new value', async () => {
    const id = (await create(student, { title: 'Wifi down in lab' })).body.ticket.id;
    await request(app).patch(`/tickets/${id}/assign`).set(bearer(admin.token)).send({ assignee_id: tech.user.id });
    await request(app).patch(`/tickets/${id}/status`).set(bearer(tech.token)).send({ status: 'In Progress' });
    const res = await request(app).get(`/tickets/${id}/events`).set(bearer(student.token));
    expect(res.status).toBe(200);
    const types = res.body.events.map((e) => `${e.event_type}:${e.old_value}>${e.new_value}`);
    expect(types).toEqual([
      'created:null>Open',
      `assigned:null>${tech.user.id}`,
      'status_changed:Open>Assigned',
      'status_changed:Assigned>In Progress',
    ]);
    expect(res.body.events[3].actor_id).toBe(tech.user.id);
    expect((await request(app).get(`/tickets/${id}/events`).set(bearer(student2.token))).status).toBe(404);
  });
});

describe('comments', () => {
  test('students cannot see or write internal notes; others can', async () => {
    const id = (await create(student, { title: 'Comment target' })).body.ticket.id;
    await request(app).patch(`/tickets/${id}/assign`).set(bearer(admin.token)).send({ assignee_id: tech.user.id });
    const post = (u, body) => request(app).post(`/tickets/${id}/comments`).set(bearer(u.token)).send(body);
    expect((await post(student, { body: 'Please hurry' })).status).toBe(201);
    expect((await post(student, { body: 'secret', is_internal: true })).status).toBe(403);
    expect((await post(tech, { body: 'Need a new part', is_internal: true })).status).toBe(201);
    expect((await post(student, { body: '' })).status).toBe(400);
    expect((await post(student2, { body: 'intruder' })).status).toBe(404);
    const get = (u) => request(app).get(`/tickets/${id}/comments`).set(bearer(u.token));
    expect((await get(student)).body.comments).toHaveLength(1);
    expect((await get(tech)).body.comments).toHaveLength(2);
  });
});
