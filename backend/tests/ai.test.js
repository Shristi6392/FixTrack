const { app, request, resetDb, makeUser, bearer, pool } = require('./helpers');
const ai = require('../src/services/ai');

let student, admin;
beforeAll(async () => { await resetDb(); student = await makeUser('student'); admin = await makeUser('admin'); });
afterAll(() => pool.end());

const fake = (text) => ({ messages: { create: async () => ({ content: [{ type: 'text', text }] }) } });
const triage = (u, body = { title: 'Sparks from socket', description: 'Burning smell' }) => request(app).post('/ai/triage').set(bearer(u.token)).send(body);

test('triage returns a validated suggestion', async () => {
  ai.setClient(fake('Sure! {"category":"Electrical","priority":"Critical","reason":"fire risk"}'));
  const res = await triage(student);
  expect(res.body).toEqual({ available: true, suggestion: { category: 'Electrical', priority: 'Critical', reason: 'fire risk' } });
});

test('invalid model output, errors or missing key never break the request', async () => {
  ai.setClient(fake('{"category":"Spaceships","priority":"Low"}'));
  expect((await triage(student)).body).toEqual({ available: false, suggestion: null });
  ai.setClient({ messages: { create: async () => { throw new Error('boom'); } } });
  expect((await triage(student)).status).toBe(200);
  ai.setClient(null);
  expect((await triage(student)).body.available).toBe(false);
});

test('only students; validation applies', async () => {
  expect((await triage(admin)).status).toBe(403);
  expect((await triage(student, { title: 'x' })).status).toBe(400);
});
