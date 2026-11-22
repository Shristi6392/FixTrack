const express = require('express');
const { z } = require('zod');
const { authenticate, requireRole } = require('../middleware/auth');
const { suggestTriage } = require('../services/ai');

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

module.exports = router;
