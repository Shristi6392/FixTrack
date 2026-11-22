require('dotenv').config({ quiet: true });
const app = require('./app');
const { startOverdueJob } = require('./jobs/overdue');
const { startPmJob } = require('./jobs/pm');

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`FixTrack API listening on :${port}`);
  startOverdueJob();
  startPmJob();
});
