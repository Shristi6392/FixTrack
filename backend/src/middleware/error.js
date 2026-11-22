const { ZodError } = require('zod');

function notFound(req, res) { res.status(404).json({ error: 'Not found' }); }

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  }
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (process.env.NODE_ENV !== 'test') console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { notFound, errorHandler };
