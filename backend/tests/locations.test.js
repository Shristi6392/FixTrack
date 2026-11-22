const { app, request, resetDb, makeUser, bearer, pool } = require('./helpers');

let student, admin;
beforeAll(async () => { await resetDb(); student = await makeUser('student'); admin = await makeUser('admin'); });
afterAll(() => pool.end());

test('admin manages locations and assets; students can read', async () => {
  const block = await request(app).post('/locations').set(bearer(admin.token)).send({ name: 'Block A', type: 'block' });
  expect(block.status).toBe(201);
  const room = await request(app).post('/locations').set(bearer(admin.token)).send({ name: 'Room 101', type: 'room', parent_id: block.body.location.id });
  expect(room.body.location.parent_id).toBe(block.body.location.id);
  expect((await request(app).post('/locations').set(bearer(student.token)).send({ name: 'X', type: 'room' })).status).toBe(403);
  expect((await request(app).get('/locations').set(bearer(student.token))).body.locations).toHaveLength(2);

  const asset = await request(app).post('/assets').set(bearer(admin.token)).send({ code: 'FAN-101', name: 'Ceiling fan', type: 'Fan', location_id: room.body.location.id });
  expect(asset.status).toBe(201);
  expect((await request(app).post('/assets').set(bearer(admin.token)).send({ code: 'FAN-101', name: 'Dup', type: 'Fan' })).status).toBe(409);
  expect((await request(app).get('/assets').set(bearer(student.token))).body.assets[0].location_name).toBe('Room 101');
  expect((await request(app).delete(`/assets/${asset.body.asset.id}`).set(bearer(admin.token))).status).toBe(204);
});

test('ticket photo upload: type and ownership checks', async () => {
  const t = (await request(app).post('/tickets').set(bearer(student.token)).send({ title: 'Leak with photo' })).body.ticket;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const ok = await request(app).post(`/tickets/${t.id}/attachments`).set(bearer(student.token)).attach('photo', png, { filename: 'a.png', contentType: 'image/png' });
  expect(ok.status).toBe(201);
  const bad = await request(app).post(`/tickets/${t.id}/attachments`).set(bearer(student.token)).attach('photo', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' });
  expect(bad.status).toBe(400);
  const other = await makeUser('student', 's2@test.com');
  expect((await request(app).post(`/tickets/${t.id}/attachments`).set(bearer(other.token)).attach('photo', png, { filename: 'a.png', contentType: 'image/png' })).status).toBe(404);
  expect((await request(app).get(`/tickets/${t.id}/attachments`).set(bearer(student.token))).body.attachments).toHaveLength(1);
});
