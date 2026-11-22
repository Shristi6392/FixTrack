const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

const ROLES = ['student', 'technician', 'admin'];
const cols = 'id,name,email,role,is_active,created_at';

router.get('/', async (req, res, next) => {
  try {
    const params = [];
    let where = '';
    if (req.query.role) { params.push(z.enum(ROLES).parse(req.query.role)); where = 'WHERE role=$1'; }
    res.json({ users: (await query(`SELECT ${cols} FROM users ${where} ORDER BY name`, params)).rows });
  } catch (e) { next(e); }
});

// Admin creates staff accounts (technicians, other admins).
router.post('/', async (req, res, next) => {
  try {
    const b = z.object({ name: z.string().min(2).max(100), email: z.string().email().toLowerCase(), password: z.string().min(8).max(100), role: z.enum(ROLES).default('technician') }).parse(req.body);
    const { rows } = await query(
      `INSERT INTO users(name,email,password_hash,role) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING RETURNING ${cols}`,
      [b.name, b.email, await bcrypt.hash(b.password, 10), b.role]);
    if (!rows[0]) return res.status(409).json({ error: 'Email already registered' });
    res.status(201).json({ user: rows[0] });
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const b = z.object({ role: z.enum(ROLES).optional(), is_active: z.boolean().optional(), name: z.string().min(2).max(100).optional() }).parse(req.body);
    if (id === req.user.id && (b.role && b.role !== 'admin' || b.is_active === false)) {
      return res.status(400).json({ error: 'You cannot demote or deactivate yourself' });
    }
    const { rows } = await query(
      `UPDATE users SET role=COALESCE($1,role), is_active=COALESCE($2,is_active), name=COALESCE($3,name) WHERE id=$4 RETURNING ${cols}`,
      [b.role ?? null, b.is_active ?? null, b.name ?? null, id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (e) { next(e); }
});

module.exports = router;
