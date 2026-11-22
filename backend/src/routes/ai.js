const express = require('express');
const { z } = require('zod');
const { authenticate, requireRole } = require('../middleware/auth');
const { query } = require('../db/pool');
const { suggestTriage, findDuplicates } = require('../services/ai');

const router = express.Router();
router.use(authenticate);

const triageSchema = z.object({ title: z.string().min(3).max(200), description: z.string().max(5000).default('') });

// Always 200: when AI is unavailable the form simply gets no suggestion and the user carries on.
router.post('/triage', requireRole('student'), async (req, res, next) => {
  try {
    const body = triageSchema.parse(req.body);
    const suggestion = await suggestTriage(body);
    res.json({ available: !!suggestion, suggestion });
  } catch (e) { next(e); }
});

const dupSchema = triageSchema.extend({ location_id: z.number().int().positive().nullish() });

// Compares a draft ticket with unfinished tickets in the same area. Returns only minimal info
// (id, title, status) because students may not see each other's tickets. Fails open: [] on any problem.
router.post('/duplicates', requireRole('student'), async (req, res, next) => {
  try {
    const b = dupSchema.parse(req.body);
    const params = [];
    let loc = '';
    if (b.location_id) { params.push(b.location_id); loc = 'AND location_id = $1'; }
    const { rows } = await query(
      `SELECT id, title, description, status FROM tickets
       WHERE deleted_at IS NULL AND status NOT IN ('Resolved','Closed') ${loc}
       ORDER BY created_at DESC LIMIT 20`, params);
    const ids = await findDuplicates(b, rows);
    res.json({ duplicates: rows.filter((r) => ids.includes(r.id)).map(({ id, title, status }) => ({ id, title, status })) });
  } catch (e) { next(e); }
});

module.exports = router;
