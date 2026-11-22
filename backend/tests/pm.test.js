const { app, request, resetDb, makeUser, bearer, pool, query } = require('./helpers');
const { runDueSchedules, advance } = require('../src/services/pm');

let admin, student, assetId;
beforeAll(async () => {
  await resetDb();
  admin = await makeUser('admin'); student = await makeUser('student');
  const loc = (await request(app).post('/locations').set(bearer(admin.token)).send({ name: 'Lab', type: 'room' })).body.location.id;
  assetId = (await request(app).post('/assets').set(bearer(admin.token)).send({ code: 'AC-1', name: 'AC unit', type: 'AC', location_id: loc })).body.asset.id;
});
afterAll(() => pool.end());

const post = (body) => request(app).post('/pm-schedules').set(bearer(admin.token)).send(body);

test('admin-only CRUD with pause/resume', async () => {
  expect((await request(app).get('/pm-schedules').set(bearer(student.token))).status).toBe(403);
  expect((await post({ asset_id: 9999, title: 'x', frequency: 'daily', next_run_at: new Date().toISOString() })).status).toBe(400);
  const s = (await post({ asset_id: assetId, title: 'Clean AC filter', frequency: 'monthly', next_run_at: new Date(Date.now() + 864e5).toISOString() })).body.schedule;
  expect(s.active).toBe(true);
  const paused = await request(app).patch(`/pm-schedules/${s.id}`).set(bearer(admin.token)).send({ active: false });
  expect(paused.body.schedule.active).toBe(false);
  expect((await request(app).delete(`/pm-schedules/${s.id}`).set(bearer(admin.token))).status).toBe(204);
  expect((await request(app).delete(`/pm-schedules/${s.id}`).set(bearer(admin.token))).status).toBe(404);
});

test('advance handles frequencies', () => {
  const d = '2026-01-31T00:00:00Z';
  expect(advance(d, 'daily').toISOString()).toBe('2026-02-01T00:00:00.000Z');
  expect(advance(d, 'weekly').toISOString()).toBe('2026-02-07T00:00:00.000Z');
});

test('job creates a ticket for due active schedules only, and reschedules into the future', async () => {
  const past = new Date(Date.now() - 3 * 864e5).toISOString();
  const due = (await post({ asset_id: assetId, title: 'Daily check', frequency: 'daily', next_run_at: past })).body.schedule;
  const paused = (await post({ asset_id: assetId, title: 'Paused', frequency: 'daily', next_run_at: past, active: false })).body.schedule;
  const future = (await post({ asset_id: assetId, title: 'Later', frequency: 'weekly', next_run_at: new Date(Date.now() + 864e5).toISOString() })).body.schedule;

  const created = await runDueSchedules();
  expect(created).toHaveLength(1); // one ticket despite 3 missed days
  const t = (await query('SELECT * FROM tickets WHERE id=$1', [created[0]])).rows[0];
  expect(t).toMatchObject({ title: '[Preventive] Daily check', asset_id: assetId, status: 'Open', requester_id: admin.user.id });
  expect(t.location_id).toBeTruthy();
  const rows = (await query('SELECT id,next_run_at FROM pm_schedules')).rows;
  expect(new Date(rows.find((r) => r.id === due.id).next_run_at) > new Date()).toBe(true);
  expect(new Date(rows.find((r) => r.id === paused.id).next_run_at).toISOString()).toBe(past);
  expect(await runDueSchedules()).toHaveLength(0); // idempotent
  expect(future.id).toBeTruthy();
});
