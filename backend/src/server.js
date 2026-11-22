require('dotenv').config({ quiet: true });
const app = require('./app');

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`FixTrack API listening on :${port}`));
