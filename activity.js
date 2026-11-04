const express = require('express');
const router = express.Router();
const { ActivityLog } = require('./models');
const { requireAuth } = require('./auth');

// Get activity log with filters
router.get('/', requireAuth, async (req, res) => {
  try {
    const { platform, appName, anomaliesOnly, limit = 50, page = 1 } = req.query;
    const filter = { customerId: req.customerId };

    if (platform) filter.platform = platform;
    if (appName) filter.appName = new RegExp(appName, 'i');
    if (anomaliesOnly === 'true') filter.isAnomaly = true;

    const [total, logs] = await Promise.all([
      ActivityLog.countDocuments(filter),
      ActivityLog.find(filter)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
    ]);

    res.json({ total, page: parseInt(page), logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
