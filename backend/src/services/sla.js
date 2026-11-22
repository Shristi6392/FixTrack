// SLA deadline (hours) per priority.
const SLA_HOURS = { Critical: 4, High: 24, Medium: 48, Low: 24 * 7 };

const dueAtFor = (priority, from = new Date()) => new Date(from.getTime() + SLA_HOURS[priority] * 3600 * 1000);

module.exports = { SLA_HOURS, dueAtFor };
