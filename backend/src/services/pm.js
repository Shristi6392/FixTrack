const { pool } = require('../db/pool');
const { dueAtFor } = require('./sla');

function advance(date, frequency) {
  const d = new Date(date);
  if (frequency === 'daily') d.setUTCDate(d.getUTCDate() + 1);
  else if (frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

// Creates one ticket per due schedule and moves next_run_at into the future.
// FOR UPDATE SKIP LOCKED makes it safe if several instances run the job at once.
async function runDueSchedules(now = new Date()) {
  const client = await pool.connect();
  const created = [];
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT s.*, a.location_id FROM pm_schedules s JOIN assets a ON a.id=s.asset_id
       WHERE s.active AND s.next_run_at <= $1 FOR UPDATE OF s SKIP LOCKED`, [now]);
    for (const s of rows) {
      const t = await client.query(
        `INSERT INTO tickets(title,description,category,priority,requester_id,location_id,asset_id,due_at)
         VALUES ($1,$2,'Other','Low',$3,$4,$5,$6) RETURNING id`,
        [`[Preventive] ${s.title}`, `Scheduled ${s.frequency} maintenance.`, s.created_by, s.location_id, s.asset_id, dueAtFor('Low', now)]);
      await client.query(`INSERT INTO ticket_events(ticket_id,actor_id,event_type,new_value) VALUES ($1,NULL,'created','Open')`, [t.rows[0].id]);
      let next = advance(s.next_run_at, s.frequency);
      while (next <= now) next = advance(next, s.frequency); // skip missed runs, don't flood
      await client.query('UPDATE pm_schedules SET next_run_at=$1 WHERE id=$2', [next, s.id]);
      created.push(t.rows[0].id);
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  return created;
}

module.exports = { runDueSchedules, advance };
