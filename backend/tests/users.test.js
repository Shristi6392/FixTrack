const { app, request, resetDb, makeUser, bearer, pool } = require('./helpers');

let student, admin;
beforeAll(async () => { await resetDb(); student = await makeUser('student'); admin = await makeUser('admin'); });
afterAll(() => pool.end());

test('users admin API', async () => {
  expect((await request(app).get('/users').set(bearer(student.token))).status).toBe(403);
  const created = await request(app).post('/users').set(bearer(admin.token)).send({ name: 'Ravi Tech', email: 'ravi@test.com', password: 'password123' });
  expect(created.status).toBe(201);
  expect(created.body.user.role).toBe('technician');
  expect(created.body.user.password_hash).toBeUndefined();
  expect((await request(app).get('/users?role=technician').set(bearer(admin.token))).body.users).toHaveLength(1);
  const off = await request(app).patch(`/users/${created.body.user.id}`).set(bearer(admin.token)).send({ is_active: false });
  expect(off.body.user.is_active).toBe(false);
  expect((await request(app).patch(`/users/${admin.user.id}`).set(bearer(admin.token)).send({ is_active: false })).status).toBe(400);
  expect((await request(app).patch('/users/9999').set(bearer(admin.token)).send({ role: 'admin' })).status).toBe(404);
});
