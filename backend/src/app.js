const express = require('express');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.use('/auth', require('./routes/auth'));

app.use('/uploads', express.static(require('path').join(__dirname, '..', 'uploads')));
app.use('/locations', require('./routes/locations'));
app.use('/assets', require('./routes/assets'));
app.use('/tickets', require('./routes/tickets'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
