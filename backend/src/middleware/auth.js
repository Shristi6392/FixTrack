const jwt = require('jsonwebtoken');
const config = require('../config');
const { query } = require('../db/pool');

// Verifies the Bearer token and loads the current user onto req.user.
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Missing token' });
    let payload;
    try { payload = jwt.verify(token, config.jwtSecret); } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
    const { rows } = await query('SELECT id,name,email,role,is_active FROM users WHERE id=$1', [payload.sub]);
    if (!rows[0] || !rows[0].is_active) return res.status(401).json({ error: 'User not found or deactivated' });
    req.user = rows[0];
    next();
  } catch (e) { next(e); }
}

// Role guard: requireRole('admin') or requireRole('technician','admin')
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Forbidden: insufficient role' });

module.exports = { authenticate, requireRole };
