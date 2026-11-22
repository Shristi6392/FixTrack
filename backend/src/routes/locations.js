const express = require('express');
const { z } = require('zod');
const { query } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const schema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['block', 'floor', 'room']),
  parent_id: z.number().int().positive().nullish(),
});
const idOf = (req) => z.coerce.number().int().positive().parse(req.params.id);

// Everyone logged in can read locations (needed by the report form).
router.get('/', async (req, res, next) => {
  try { res.json({ locations: (await query('SELECT * FROM locations ORDER BY type, name')).rows }); } catch (e) { next(e); }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const b = schema.parse(req.body);
    const { rows } = await query('INSERT INTO locations(name,type,parent_id) VALUES ($1,$2,$3) RETURNING *', [b.name, b.type, b.parent_id ?? null]);
    res.status(201).json({ location: rows[0] });
  } catch (e) { next(e); }
});

router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const b = schema.parse(req.body);
    const { rows } = await query('UPDATE locations SET name=$1,type=$2,parent_id=$3 WHERE id=$4 RETURNING *', [b.name, b.type, b.parent_id ?? null, idOf(req)]);
    if (!rows[0]) return res.status(404).json({ error: 'Location not found' });
    res.json({ location: rows[0] });
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM locations WHERE id=$1', [idOf(req)]);
    if (!rowCount) return res.status(404).json({ error: 'Location not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
