const { app, request, resetDb, makeUser, bearer, pool, query } = require('./helpers');
const { requireRole } = require('../src/middleware/auth');

beforeAll(resetDb);
afterAll(() => pool.end());

describe('auth', () => {
  test('register creates a student and returns a token', async () => {
    const res = await request(app).post('/auth/register').send({ name: 'Asha', email: 'Asha@Test.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'asha@test.com', role: 'student' });
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.password_hash).toBeUndefined();
  });

  test('password is stored hashed', async () => {
    const { rows } = await query("SELECT password_hash FROM users WHERE email='asha@test.com'");
    expect(rows[0].password_hash).not.toBe('password123');
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
  });

  test('register ignores a client-supplied role', async () => {
    const res = await request(app).post('/auth/register').send({ name: 'Eve', email: 'eve@test.com', password: 'password123', role: 'admin' });
    expect(res.body.user.role).toBe('student');
  });

  test('duplicate email -> 409', async () => {
    const res = await request(app).post('/auth/register').send({ name: 'Asha', email: 'asha@test.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  test('invalid payload -> 400', async () => {
    const res = await request(app).post('/auth/register').send({ name: 'A', email: 'nope', password: '1' });
    expect(res.status).toBe(400);
  });

  test('login success and failure', async () => {
    expect((await request(app).post('/auth/login').send({ email: 'asha@test.com', password: 'password123' })).status).toBe(200);
    expect((await request(app).post('/auth/login').send({ email: 'asha@test.com', password: 'wrong' })).status).toBe(401);
    expect((await request(app).post('/auth/login').send({ email: 'ghost@test.com', password: 'password123' })).status).toBe(401);
  });

  test('deactivated user cannot login or use old token', async () => {
    const { token } = await makeUser('student', 'gone@test.com');
    await query("UPDATE users SET is_active=false WHERE email='gone@test.com'");
    expect((await request(app).get('/auth/me').set(bearer(token))).status).toBe(401);
    expect((await request(app).post('/auth/login').send({ email: 'gone@test.com', password: 'password123' })).status).toBe(401);
  });
});

describe('JWT middleware and role guard', () => {
  test('/auth/me requires a valid token', async () => {
    expect((await request(app).get('/auth/me')).status).toBe(401);
    expect((await request(app).get('/auth/me').set(bearer('garbage'))).status).toBe(401);
    const { token } = await makeUser('admin');
    const res = await request(app).get('/auth/me').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });

  test('requireRole allows listed roles and blocks others', () => {
    const run = (role) => { const out = {}; const res = { status: (c) => ({ json: () => { out.code = c; } }) }; requireRole('admin')({ user: { role } }, res, () => { out.next = true; }); return out; };
    expect(run('admin').next).toBe(true);
    expect(run('student').code).toBe(403);
  });
});
