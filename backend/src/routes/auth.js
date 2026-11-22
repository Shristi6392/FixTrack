const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { query } = require('../db/pool');
const config = require('../config');

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(100),
});
const loginSchema = z.object({ email: z.string().email().toLowerCase(), password: z.string().min(1) });

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const signToken = (u) => jwt.sign({ sub: u.id, role: u.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

// Public registration always creates a student; admins create technicians via /users.
router.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const hash = await bcrypt.hash(body.password, 10);
    const { rows } = await query(
      `INSERT INTO users(name,email,password_hash,role) VALUES ($1,$2,$3,'student')
       ON CONFLICT (email) DO NOTHING RETURNING *`,
      [body.name, body.email, hash]
    );
    if (!rows[0]) return res.status(409).json({ error: 'Email already registered' });
    res.status(201).json({ user: publicUser(rows[0]), token: signToken(rows[0]) });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const { rows } = await query('SELECT * FROM users WHERE email=$1', [body.email]);
    const u = rows[0];
    if (!u || !u.is_active || !(await bcrypt.compare(body.password, u.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json({ user: publicUser(u), token: signToken(u) });
  } catch (e) { next(e); }
});

module.exports = router;
