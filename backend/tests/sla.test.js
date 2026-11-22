const { app, request, resetDb, makeUser, bearer, pool, query } = require('./helpers');
const { flagOverdue } = require('../src/jobs/overdue');
const { dueAtFor, SLA_HOURS } = require('../src/services/sla');

let student, admin;
beforeAll(async () => { await resetDb(); student = await makeUser('student'); admin = await makeUser('admin'); });
afterAll(() => pool.end());

test('due date is set from priority', async () => {
  expect(SLA_HOURS).toEqual({ Critical: 4, High: 24, Medium: 48, Low: 168 });
  const now = new Date('2026-01-01T00:00:00Z');
  expect(dueAtFor('Critical', now).toISOString()).toBe('2026-01-01T04:00:00.000Z');
  const t = (await request(app).post('/tickets').set(bearer(student.token)).send({ title: 'Urgent fire alarm', priority: 'Critical' })).body.ticket;
  const hours = (new Date(t.due_at) - new Date(t.created_at)) / 3600000;
  expect(Math.round(hours)).toBe(4);
});

test('job flags only unfinished tickets past due; filter and clearing work', async () => {
  const mk = async (title) => (await request(app).post('/tickets').set(bearer(student.token)).send({ title })).body.ticket.id;
  const late = await mk('Late one'); const lateDone = await mk('Late but resolved'); const fine = await mk('Still fine');
  await query("UPDATE tickets SET due_at = now() - interval '1 hour' WHERE id = ANY($1)", [[late, lateDone]]);
  await query("UPDATE tickets SET status='Resolved' WHERE id=$1", [lateDone]);

  const flagged = await flagOverdue();
  expect(flagged.map((r) => r.id)).toEqual([late]);

  const over = await request(app).get('/tickets?overdue=true').set(bearer(admin.token));
  expect(over.body.tickets.map((t) => t.id)).toEqual([late]);
  const notOver = await request(app).get('/tickets?overdue=false').set(bearer(admin.token));
  expect(notOver.body.tickets.map((t) => t.id)).toContain(fine);

  await query("UPDATE tickets SET status='Closed' WHERE id=$1", [late]);
  await flagOverdue();
  expect((await query('SELECT is_overdue FROM tickets WHERE id=$1', [late])).rows[0].is_overdue).toBe(false);
});
