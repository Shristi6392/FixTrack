const cron = require('node-cron');
const { query } = require('../db/pool');

// Flags unfinished tickets past their SLA deadline; clears the flag once a ticket is finished.
async function flagOverdue() {
  const flagged = await query(
    `UPDATE tickets SET is_overdue=true
     WHERE is_overdue=false AND deleted_at IS NULL AND due_at < now() AND status NOT IN ('Resolved','Closed')
     RETURNING id, requester_id, assignee_id, title`);
  await query(`UPDATE tickets SET is_overdue=false WHERE is_overdue=true AND status IN ('Resolved','Closed')`);
  return flagged.rows;
}

function startOverdueJob(onFlagged) {
  return cron.schedule('*/5 * * * *', async () => {
    try { const rows = await flagOverdue(); if (rows.length && onFlagged) await onFlagged(rows); } catch (e) { console.error('overdue job failed', e); }
  });
}

module.exports = { flagOverdue, startOverdueJob };
