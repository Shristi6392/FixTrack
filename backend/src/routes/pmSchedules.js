const express = require('express');
const { z } = require('zod');
const { query } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

const schema = z.object({
  asset_id: z.number().int().positive(),
  title: z.string().min(2).max(200),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  next_run_at: z.string().datetime({ offset: true }),
  active: z.boolean().default(true),
});
const idOf = (req) => z.coerce.number().int().positive().parse(req.params.id);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.*, a.code AS asset_code, a.name AS asset_name FROM pm_schedules s JOIN assets a ON a.id=s.asset_id ORDER BY s.next_run_at`);
    res.json({ schedules: rows });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = schema.parse(req.body);
    if (!(await query('SELECT 1 FROM assets WHERE id=$1', [b.asset_id])).rows[0]) return res.status(400).json({ error: 'Unknown asset' });
    const { rows } = await query(
      'INSERT INTO pm_schedules(asset_id,title,frequency,next_run_at,active,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [b.asset_id, b.title, b.frequency, b.next_run_at, b.active, req.user.id]);
    res.status(201).json({ schedule: rows[0] });
  } catch (e) { next(e); }
});

// Edit, pause (active:false) or resume.
router.patch('/:id', async (req, res, next) => {
  try {
    const b = schema.partial().parse(req.body);
    const { rows } = await query(
      `UPDATE pm_schedules SET asset_id=COALESCE($1,asset_id), title=COALESCE($2,title), frequency=COALESCE($3,frequency),
         next_run_at=COALESCE($4,next_run_at), active=COALESCE($5,active) WHERE id=$6 RETURNING *`,
      [b.asset_id ?? null, b.title ?? null, b.frequency ?? null, b.next_run_at ?? null, b.active ?? null, idOf(req)]);
    if (!rows[0]) return res.status(404).json({ error: 'Schedule not found' });
    res.json({ schedule: rows[0] });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM pm_schedules WHERE id=$1', [idOf(req)]);
    if (!rowCount) return res.status(404).json({ error: 'Schedule not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
