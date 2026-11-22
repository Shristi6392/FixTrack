const express = require('express');
const { z } = require('zod');
const { query } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

const rangeSchema = z.object({ from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional() });

// Builds "WHERE" on tickets created within the optional range, excluding soft-deleted ones.
function range(q) {
  const r = rangeSchema.parse(q);
  const params = [];
  const where = ['t.deleted_at IS NULL'];
  if (r.from) { params.push(r.from); where.push(`t.created_at >= $${params.length}`); }
  if (r.to) { params.push(r.to); where.push(`t.created_at <= $${params.length}`); }
  return { where: where.join(' AND '), params };
}

router.get('/summary', async (req, res, next) => {
  try {
    const { where, params } = range(req.query);
    const counts = (await query(
      `SELECT count(*)::int AS total,
         count(*) FILTER (WHERE t.status IN ('Open','Assigned','In Progress','Reopened'))::int AS open,
         count(*) FILTER (WHERE t.is_overdue)::int AS overdue,
         count(*) FILTER (WHERE t.status IN ('Resolved','Closed'))::int AS resolved,
         round(avg(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600) FILTER (WHERE t.resolved_at IS NOT NULL)::numeric, 1)::float AS avg_resolution_hours
       FROM tickets t WHERE ${where}`, params)).rows[0];
    const workload = (await query(
      `SELECT u.id, u.name,
         count(t.id) FILTER (WHERE t.status IN ('Assigned','In Progress','Reopened'))::int AS active,
         count(t.id) FILTER (WHERE t.status IN ('Resolved','Closed'))::int AS completed
       FROM users u LEFT JOIN tickets t ON t.assignee_id=u.id AND ${where}
       WHERE u.role='technician' AND u.is_active GROUP BY u.id ORDER BY active DESC, u.name`, params)).rows;
    res.json({ ...counts, workload });
  } catch (e) { next(e); }
});

router.get('/by-category', async (req, res, next) => {
  try {
    const { where, params } = range(req.query);
    const group = async (expr, join = '') => (await query(
      `SELECT ${expr} AS label, count(*)::int AS count FROM tickets t ${join} WHERE ${where} GROUP BY 1 ORDER BY 2 DESC, 1`, params)).rows;
    res.json({
      by_category: await group('t.category'),
      by_priority: await group('t.priority'),
      by_location: await group("COALESCE(l.name,'Unspecified')", 'LEFT JOIN locations l ON l.id=t.location_id'),
    });
  } catch (e) { next(e); }
});

// Assets with the most tickets; flagged when they reach the repeat-failure threshold.
router.get('/failing-assets', async (req, res, next) => {
  try {
    const { where, params } = range(req.query);
    const threshold = 3;
    const { rows } = await query(
      `SELECT a.id, a.code, a.name, l.name AS location_name, count(t.id)::int AS ticket_count
       FROM assets a JOIN tickets t ON t.asset_id=a.id AND ${where}
       LEFT JOIN locations l ON l.id=a.location_id
       GROUP BY a.id, l.name ORDER BY ticket_count DESC, a.code LIMIT 10`, params);
    res.json({ threshold, assets: rows.map((r) => ({ ...r, repeat_failure: r.ticket_count >= threshold })) });
  } catch (e) { next(e); }
});

module.exports = router;
