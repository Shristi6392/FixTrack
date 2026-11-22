const express = require('express');
const { z } = require('zod');
const { query } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { logEvent } = require('../services/events');
const { PRIORITIES, CATEGORIES, STATUSES } = require('../constants');

const router = express.Router();
router.use(authenticate);

const createSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).default(''),
  category: z.enum(CATEGORIES).default('Other'),
  priority: z.enum(PRIORITIES).default('Medium'),
  location_id: z.number().int().positive().nullish(),
  asset_id: z.number().int().positive().nullish(),
});

const listSchema = z.object({
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  category: z.enum(CATEGORIES).optional(),
  location_id: z.coerce.number().int().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Role scoping: students see own tickets, technicians see assigned ones, admins see all.
function scopeClause(user, params) {
  if (user.role === 'student') { params.push(user.id); return `t.requester_id = $${params.length}`; }
  if (user.role === 'technician') { params.push(user.id); return `t.assignee_id = $${params.length}`; }
  return 'true';
}

const SELECT = `SELECT t.*, r.name AS requester_name, a.name AS assignee_name, l.name AS location_name, ast.code AS asset_code
  FROM tickets t
  JOIN users r ON r.id = t.requester_id
  LEFT JOIN users a ON a.id = t.assignee_id
  LEFT JOIN locations l ON l.id = t.location_id
  LEFT JOIN assets ast ON ast.id = t.asset_id`;

router.post('/', requireRole('student'), async (req, res, next) => {
  try {
    const b = createSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO tickets(title,description,category,priority,requester_id,location_id,asset_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [b.title, b.description, b.category, b.priority, req.user.id, b.location_id ?? null, b.asset_id ?? null]
    );
    await logEvent(rows[0].id, req.user.id, 'created', null, 'Open');
    res.status(201).json({ ticket: rows[0] });
  } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try {
    const f = listSchema.parse(req.query);
    const params = [];
    const where = ['t.deleted_at IS NULL', scopeClause(req.user, params)];
    const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
    if (f.status) add('t.status = ?', f.status);
    if (f.priority) add('t.priority = ?', f.priority);
    if (f.category) add('t.category = ?', f.category);
    if (f.location_id) add('t.location_id = ?', f.location_id);
    if (f.from) add('t.created_at >= ?', f.from);
    if (f.to) add('t.created_at <= ?', f.to);
    if (f.q) { params.push(`%${f.q}%`); where.push(`(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`); }
    const whereSql = where.join(' AND ');
    const total = (await query(`SELECT count(*)::int AS n FROM tickets t WHERE ${whereSql}`, params)).rows[0].n;
    const { rows } = await query(
      `${SELECT} WHERE ${whereSql} ORDER BY t.created_at DESC, t.id DESC LIMIT ${f.limit} OFFSET ${(f.page - 1) * f.limit}`,
      params
    );
    res.json({ tickets: rows, page: f.page, limit: f.limit, total });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const params = [id];
    const { rows } = await query(`${SELECT} WHERE t.id = $1 AND t.deleted_at IS NULL AND ${scopeClause(req.user, params)}`, params);
    if (!rows[0]) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ ticket: rows[0] });
  } catch (e) { next(e); }
});

// Photo upload (field name "photo"); requester, assignee or admin.
router.post('/:id/attachments', upload.single('photo'), async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const params = [id];
    const t = await query(`SELECT t.id FROM tickets t WHERE t.id=$1 AND t.deleted_at IS NULL AND ${scopeClause(req.user, params)}`, params);
    if (!t.rows[0]) return res.status(404).json({ error: 'Ticket not found' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded (field "photo")' });
    const { rows } = await query('INSERT INTO attachments(ticket_id,url,uploaded_by) VALUES ($1,$2,$3) RETURNING *',
      [id, `/uploads/${req.file.filename}`, req.user.id]);
    await logEvent(id, req.user.id, 'attachment_added', null, rows[0].url);
    res.status(201).json({ attachment: rows[0] });
  } catch (e) { next(e); }
});

router.get('/:id/attachments', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const params = [id];
    const t = await query(`SELECT t.id FROM tickets t WHERE t.id=$1 AND t.deleted_at IS NULL AND ${scopeClause(req.user, params)}`, params);
    if (!t.rows[0]) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ attachments: (await query('SELECT * FROM attachments WHERE ticket_id=$1 ORDER BY id', [id])).rows });
  } catch (e) { next(e); }
});

// ---- Status lifecycle -------------------------------------------------------
// Allowed transitions and which roles may perform them.
const TRANSITIONS = {
  Assigned: { 'In Progress': ['technician', 'admin'] },
  'In Progress': { Resolved: ['technician', 'admin'] },
  Resolved: { Closed: ['student', 'admin'], Reopened: ['student', 'admin'] },
  Reopened: { 'In Progress': ['technician', 'admin'] },
  Open: {},
  Closed: {},
};

const statusSchema = z.object({ status: z.enum(STATUSES) });
const assignSchema = z.object({ assignee_id: z.number().int().positive() });

async function loadTicket(id) {
  const { rows } = await query('SELECT * FROM tickets WHERE id=$1 AND deleted_at IS NULL', [id]);
  return rows[0];
}

router.patch('/:id/status', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { status } = statusSchema.parse(req.body);
    const t = await loadTicket(id);
    if (!t) return res.status(404).json({ error: 'Ticket not found' });
    const { role, id: uid } = req.user;
    // Students may only touch their own tickets, technicians only assigned ones.
    if ((role === 'student' && t.requester_id !== uid) || (role === 'technician' && t.assignee_id !== uid)) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const allowedRoles = (TRANSITIONS[t.status] || {})[status];
    if (!allowedRoles) return res.status(409).json({ error: `Cannot move ticket from ${t.status} to ${status}` });
    if (!allowedRoles.includes(role)) return res.status(403).json({ error: `Role ${role} cannot set status ${status}` });
    const { rows } = await query(
      `UPDATE tickets SET status=$1, updated_at=now(),
         resolved_at = CASE WHEN $1='Resolved' THEN now() WHEN $1='Reopened' THEN NULL ELSE resolved_at END
       WHERE id=$2 RETURNING *`,
      [status, id]
    );
    await logEvent(id, uid, 'status_changed', t.status, status);
    res.json({ ticket: rows[0] });
  } catch (e) { next(e); }
});

router.patch('/:id/assign', requireRole('admin'), async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { assignee_id } = assignSchema.parse(req.body);
    const t = await loadTicket(id);
    if (!t) return res.status(404).json({ error: 'Ticket not found' });
    if (['Resolved', 'Closed'].includes(t.status)) return res.status(409).json({ error: `Cannot assign a ${t.status} ticket` });
    const tech = (await query("SELECT id FROM users WHERE id=$1 AND role='technician' AND is_active", [assignee_id])).rows[0];
    if (!tech) return res.status(400).json({ error: 'assignee_id must be an active technician' });
    const newStatus = ['Open', 'Reopened'].includes(t.status) ? 'Assigned' : t.status;
    const { rows } = await query(
      'UPDATE tickets SET assignee_id=$1, status=$2, updated_at=now() WHERE id=$3 RETURNING *',
      [assignee_id, newStatus, id]
    );
    await logEvent(id, req.user.id, t.assignee_id ? 'reassigned' : 'assigned', t.assignee_id, assignee_id);
    if (newStatus !== t.status) await logEvent(id, req.user.id, 'status_changed', t.status, newStatus);
    res.json({ ticket: rows[0] });
  } catch (e) { next(e); }
});

// Full history of a ticket (visible to anyone who can see the ticket).
router.get('/:id/events', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const params = [id];
    const t = await query(`SELECT t.id FROM tickets t WHERE t.id=$1 AND t.deleted_at IS NULL AND ${scopeClause(req.user, params)}`, params);
    if (!t.rows[0]) return res.status(404).json({ error: 'Ticket not found' });
    const { rows } = await query(
      `SELECT e.*, u.name AS actor_name FROM ticket_events e LEFT JOIN users u ON u.id=e.actor_id
       WHERE e.ticket_id=$1 ORDER BY e.created_at, e.id`, [id]);
    res.json({ events: rows });
  } catch (e) { next(e); }
});

module.exports = router;
