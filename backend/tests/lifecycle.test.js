const { app, request, resetDb, makeUser, bearer, pool, query } = require('./helpers');

let student, tech, tech2, admin;
beforeAll(async () => {
  await resetDb();
  student = await makeUser('student');
  tech = await makeUser('technician');
  tech2 = await makeUser('technician', 'tech2@test.com');
  admin = await makeUser('admin');
});
afterAll(() => pool.end());

const api = (method, path, u, body) => request(app)[method](path).set(bearer(u.token)).send(body);

test('full lifecycle: Open -> Assigned -> In Progress -> Resolved -> Reopened -> ... -> Closed', async () => {
  const { id } = (await api('post', '/tickets', student, { title: 'Socket sparks', category: 'Electrical', priority: 'Critical' })).body.ticket;
  await api('patch', `/tickets/${id}/assign`, admin, { assignee_id: tech.user.id });
  await api('patch', `/tickets/${id}/status`, tech, { status: 'In Progress' });
  await api('patch', `/tickets/${id}/status`, tech, { status: 'Resolved' });
  await api('patch', `/tickets/${id}/status`, student, { status: 'Reopened' });
  await api('patch', `/tickets/${id}/assign`, admin, { assignee_id: tech2.user.id }); // reassign
  await api('patch', `/tickets/${id}/status`, tech2, { status: 'In Progress' });
  await api('patch', `/tickets/${id}/status`, tech2, { status: 'Resolved' });
  const closed = await api('patch', `/tickets/${id}/status`, student, { status: 'Closed' });
  expect(closed.body.ticket.status).toBe('Closed');

  const events = (await api('get', `/tickets/${id}/events`, admin)).body.events;
  expect(events.filter((e) => e.event_type === 'status_changed').map((e) => e.new_value))
    .toEqual(['Assigned', 'In Progress', 'Resolved', 'Reopened', 'Assigned', 'In Progress', 'Resolved', 'Closed']);
  expect(events.some((e) => e.event_type === 'reassigned')).toBe(true);
});

test('invalid transitions are rejected and not logged', async () => {
  const { id } = (await api('post', '/tickets', student, { title: 'Dirty corridor', category: 'Cleaning' })).body.ticket;
  expect((await api('patch', `/tickets/${id}/status`, admin, { status: 'Resolved' })).status).toBe(409);
  expect((await api('patch', `/tickets/${id}/status`, student, { status: 'Closed' })).status).toBe(409);
  expect((await api('get', `/tickets/${id}/events`, admin)).body.events).toHaveLength(1);
});

test('technician cannot act on a ticket assigned to someone else', async () => {
  const { id } = (await api('post', '/tickets', student, { title: 'Door jammed' })).body.ticket;
  await api('patch', `/tickets/${id}/assign`, admin, { assignee_id: tech.user.id });
  expect((await api('patch', `/tickets/${id}/status`, tech2, { status: 'In Progress' })).status).toBe(404);
  expect((await api('get', `/tickets/${id}`, tech2)).status).toBe(404);
});

test('deactivated technician cannot be assigned; unknown ticket is 404', async () => {
  const { id } = (await api('post', '/tickets', student, { title: 'Broken bench' })).body.ticket;
  await query("UPDATE users SET is_active=false WHERE id=$1", [tech2.user.id]);
  expect((await api('patch', `/tickets/${id}/assign`, admin, { assignee_id: tech2.user.id })).status).toBe(400);
  expect((await api('patch', '/tickets/99999/assign', admin, { assignee_id: tech.user.id })).status).toBe(404);
});

test('soft-deleted tickets are hidden everywhere', async () => {
  const { id } = (await api('post', '/tickets', student, { title: 'Ghost ticket' })).body.ticket;
  await query('UPDATE tickets SET deleted_at=now() WHERE id=$1', [id]);
  expect((await api('get', `/tickets/${id}`, admin)).status).toBe(404);
  const list = await api('get', '/tickets?q=Ghost', admin);
  expect(list.body.total).toBe(0);
});
