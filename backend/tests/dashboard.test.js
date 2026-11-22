const { app, request, resetDb, makeUser, bearer, pool, query } = require('./helpers');

let admin, student, tech, assetId, locId;
beforeAll(async () => {
  await resetDb();
  admin = await makeUser('admin'); student = await makeUser('student'); tech = await makeUser('technician');
  locId = (await request(app).post('/locations').set(bearer(admin.token)).send({ name: 'Hostel B', type: 'block' })).body.location.id;
  assetId = (await request(app).post('/assets').set(bearer(admin.token)).send({ code: 'GEY-1', name: 'Geyser', type: 'Geyser', location_id: locId })).body.asset.id;
  const mk = (b) => request(app).post('/tickets').set(bearer(student.token)).send(b);
  const t1 = (await mk({ title: 'Geyser cold 1', category: 'Plumbing', priority: 'High', asset_id: assetId, location_id: locId })).body.ticket;
  await mk({ title: 'Geyser cold 2', category: 'Plumbing', asset_id: assetId, location_id: locId });
  await mk({ title: 'Geyser cold 3', category: 'Plumbing', asset_id: assetId });
  await mk({ title: 'Light broken', category: 'Electrical', priority: 'Low' });
  await request(app).patch(`/tickets/${t1.id}/assign`).set(bearer(admin.token)).send({ assignee_id: tech.user.id });
  await query("UPDATE tickets SET status='Resolved', resolved_at=created_at + interval '5 hours' WHERE id=$1", [t1.id]);
  await query("UPDATE tickets SET is_overdue=true WHERE title='Light broken'");
});
afterAll(() => pool.end());

const get = (path, u = admin) => request(app).get(path).set(bearer(u.token));

test('admin only', async () => {
  expect((await get('/dashboard/summary', student)).status).toBe(403);
  expect((await request(app).get('/dashboard/summary')).status).toBe(401);
});

test('summary counts, average resolution and technician workload', async () => {
  const r = (await get('/dashboard/summary')).body;
  expect(r).toMatchObject({ total: 4, open: 3, overdue: 1, resolved: 1, avg_resolution_hours: 5 });
  expect(r.workload).toEqual([{ id: tech.user.id, name: 'technician', active: 0, completed: 1 }]);
});

test('breakdowns and date range filter', async () => {
  const r = (await get('/dashboard/by-category')).body;
  expect(r.by_category).toEqual([{ label: 'Plumbing', count: 3 }, { label: 'Electrical', count: 1 }]);
  expect(r.by_location).toEqual(expect.arrayContaining([{ label: 'Hostel B', count: 2 }, { label: 'Unspecified', count: 2 }]));
  expect(r.by_priority.find((p) => p.label === 'High').count).toBe(1);
  const future = (await get(`/dashboard/summary?from=${encodeURIComponent(new Date(Date.now() + 864e5).toISOString())}`)).body;
  expect(future.total).toBe(0);
  expect((await get('/dashboard/summary?from=notadate')).status).toBe(400);
});

test('failing assets flags repeat failures', async () => {
  const r = (await get('/dashboard/failing-assets')).body;
  expect(r.assets[0]).toMatchObject({ code: 'GEY-1', ticket_count: 3, repeat_failure: true });
});
