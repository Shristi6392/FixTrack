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

describe('duplicate detection', () => {
  const dup = (body) => request(app).post('/ai/duplicates').set(bearer(student.token)).send(body);
  let loc1, loc2, t1;
  beforeAll(async () => {
    loc1 = (await request(app).post('/locations').set(bearer(admin.token)).send({ name: 'Room 1', type: 'room' })).body.location.id;
    loc2 = (await request(app).post('/locations').set(bearer(admin.token)).send({ name: 'Room 2', type: 'room' })).body.location.id;
    const mk = async (title, location_id) => (await request(app).post('/tickets').set(bearer(student.token)).send({ title, location_id })).body.ticket.id;
    t1 = await mk('Tap leaking', loc1);
    await mk('Tap leaking elsewhere', loc2);
  });

  test('returns matches among open tickets in the same location only', async () => {
    let seen;
    ai.setClient({ messages: { create: async (a) => { seen = a.messages[0].content; return { content: [{ type: 'text', text: `{"duplicate_ids":[${t1}, 99999]}` }] }; } } });
    const res = await dup({ title: 'Water tap dripping', location_id: loc1 });
    expect(res.body.duplicates).toEqual([{ id: t1, title: 'Tap leaking', status: 'Open' }]);
    expect(seen).toContain('Tap leaking');
    expect(seen).not.toContain('elsewhere');
  });

  test('fails open when AI is down or nothing to compare', async () => {
    ai.setClient(null);
    expect((await dup({ title: 'Water tap dripping', location_id: loc1 })).body.duplicates).toEqual([]);
    ai.setClient(fake('{"duplicate_ids":[1]}'));
    expect((await dup({ title: 'Something new', location_id: 424242 })).body.duplicates).toEqual([]);
  });
});
