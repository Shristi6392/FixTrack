const express = require('express');
const { z } = require('zod');
const { query } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const schema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  type: z.string().min(1).max(50),
  location_id: z.number().int().positive().nullish(),
  status: z.enum(['active', 'under_repair', 'retired']).default('active'),
});
const idOf = (req) => z.coerce.number().int().positive().parse(req.params.id);

router.get('/', async (req, res, next) => {
  try {
    const params = [];
    let where = '';
    if (req.query.location_id) { params.push(Number(req.query.location_id)); where = 'WHERE a.location_id=$1'; }
    const { rows } = await query(
      `SELECT a.*, l.name AS location_name,
         (SELECT count(*)::int FROM tickets t WHERE t.asset_id=a.id AND t.deleted_at IS NULL) AS ticket_count
       FROM assets a LEFT JOIN locations l ON l.id=a.location_id ${where} ORDER BY a.code`, params);
    res.json({ assets: rows });
  } catch (e) { next(e); }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const b = schema.parse(req.body);
    const { rows } = await query(
      'INSERT INTO assets(code,name,type,location_id,status) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (code) DO NOTHING RETURNING *',
      [b.code, b.name, b.type, b.location_id ?? null, b.status]);
    if (!rows[0]) return res.status(409).json({ error: 'Asset code already exists' });
    res.status(201).json({ asset: rows[0] });
  } catch (e) { next(e); }
});

router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const b = schema.parse(req.body);
    const { rows } = await query(
      'UPDATE assets SET code=$1,name=$2,type=$3,location_id=$4,status=$5 WHERE id=$6 RETURNING *',
      [b.code, b.name, b.type, b.location_id ?? null, b.status, idOf(req)]);
    if (!rows[0]) return res.status(404).json({ error: 'Asset not found' });
    res.json({ asset: rows[0] });
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM assets WHERE id=$1', [idOf(req)]);
    if (!rowCount) return res.status(404).json({ error: 'Asset not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
