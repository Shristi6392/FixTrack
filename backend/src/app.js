const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { notFound, errorHandler } = require('./middleware/error');
const { rateLimit } = require('./middleware/rateLimit');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',') }));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
// Rate limit the public (unauthenticated) routes. Disabled under test unless RATE_LIMIT_ENABLED=1.
if (process.env.NODE_ENV !== 'test' || process.env.RATE_LIMIT_ENABLED) {
  app.use('/auth/login', rateLimit({ name: 'login', windowSec: 60, max: 10 }));
  app.use('/auth/register', rateLimit({ name: 'register', windowSec: 3600, max: 20 }));
}
app.use('/auth', require('./routes/auth'));

app.use('/uploads', express.static(require('path').join(__dirname, '..', 'uploads')));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/pm-schedules', require('./routes/pmSchedules'));
app.use('/ai', require('./routes/ai'));
app.use('/users', require('./routes/users'));
app.use('/locations', require('./routes/locations'));
app.use('/assets', require('./routes/assets'));
app.use('/tickets', require('./routes/tickets'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
