const express = require('express');
const request = require('supertest');
const Redis = require('ioredis');
const { rateLimit, MemoryStore, RedisStore } = require('../src/middleware/rateLimit');

const mkApp = (opts) => { const a = express(); a.use(rateLimit(opts)); a.get('/', (req, res) => res.json({ ok: true })); return a; };

test('blocks after max requests in the window, with headers', async () => {
  const app = mkApp({ name: 't1', max: 3, windowSec: 60, store: new MemoryStore() });
  for (let i = 0; i < 3; i++) expect((await request(app).get('/')).status).toBe(200);
  const res = await request(app).get('/');
  expect(res.status).toBe(429);
  expect(res.headers['retry-after']).toBeDefined();
  expect(res.headers['x-ratelimit-remaining']).toBe('0');
});

test('window resets', async () => {
  const store = new MemoryStore();
  const app = mkApp({ name: 't2', max: 1, windowSec: 1, store });
  await request(app).get('/');
  expect((await request(app).get('/')).status).toBe(429);
  await new Promise((r) => setTimeout(r, 1100));
  expect((await request(app).get('/')).status).toBe(200);
});

test('fails open when the store is broken', async () => {
  const app = mkApp({ name: 't3', max: 1, store: { incr: async () => { throw new Error('redis down'); } } });
  expect((await request(app).get('/')).status).toBe(200);
  expect((await request(app).get('/')).status).toBe(200);
});

const redisTest = process.env.REDIS_URL ? test : test.skip;
redisTest('works against real Redis', async () => {
  const client = new Redis(process.env.REDIS_URL);
  const name = `test-${Date.now()}`;
  const app = mkApp({ name, max: 2, store: new RedisStore(client) });
  expect((await request(app).get('/')).status).toBe(200);
  expect((await request(app).get('/')).status).toBe(200);
  expect((await request(app).get('/')).status).toBe(429);
  client.disconnect();
});
