const { query } = require('../db/pool');

// Appends a row to ticket_events: who changed what, from/to, when.
async function logEvent(ticketId, actorId, eventType, oldValue = null, newValue = null) {
  await query(
    'INSERT INTO ticket_events(ticket_id,actor_id,event_type,old_value,new_value) VALUES ($1,$2,$3,$4,$5)',
    [ticketId, actorId, eventType, oldValue == null ? null : String(oldValue), newValue == null ? null : String(newValue)]
  );
}

module.exports = { logEvent };
