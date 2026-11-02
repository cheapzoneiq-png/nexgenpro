const express = require('express');
const router = express.Router();
const { Alert } = require('../models');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const { severity, resolved, limit = 20 } = req.query;
    const filter = { customerId: req.customerId };

    if (severity) filter.severity = severity;
    if (resolved !== undefined) filter.resolved = resolved === 'true';

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('activityLogId');

    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
