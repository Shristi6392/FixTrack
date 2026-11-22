process.env.RATE_LIMIT_ENABLED = '1';
const { app, request, resetDb, pool } = require('./helpers');

beforeAll(resetDb);
afterAll(() => pool.end());

test('login is rate limited on the real app', async () => {
  let last;
  for (let i = 0; i < 11; i++) last = await request(app).post('/auth/login').send({ email: 'a@b.com', password: 'x' });
  expect(last.status).toBe(429);
});
