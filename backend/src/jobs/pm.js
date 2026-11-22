const cron = require('node-cron');
const { runDueSchedules } = require('../services/pm');

function startPmJob() {
  return cron.schedule('0 * * * *', () => runDueSchedules().catch((e) => console.error('pm job failed', e)));
}

module.exports = { startPmJob };
