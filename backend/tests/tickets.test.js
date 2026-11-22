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
