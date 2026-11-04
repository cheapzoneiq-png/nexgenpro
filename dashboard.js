const express = require('express');
const router = express.Router();
const { ActivityLog, Alert, Baseline, Customer } = require('./models');
const { requireAuth } = require('./auth');

// Main dashboard stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const customerId = req.customerId;
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      threatsBlocked,
      alertsTotal,
      activeMonitors,
      recentActivity,
      unresolvedAlerts,
      customer
    ] = await Promise.all([
      Alert.countDocuments({ customerId, severity: { $in: ['high', 'critical'] }, createdAt: { $gte: last7d } }),
      Alert.countDocuments({ customerId, createdAt: { $gte: last7d } }),
      Baseline.countDocuments({ customerId }),
      ActivityLog.find({ customerId, timestamp: { $gte: last24h } })
        .sort({ timestamp: -1 }).limit(20),
      Alert.find({ customerId, resolved: false }).sort({ createdAt: -1 }).limit(10),
      Customer.findById(customerId)
    ]);

    res.json({
      stats: {
        threatsBlocked,
        alertsSent: alertsTotal,
        activeMonitors,
        dataLeaksPrevented: await Alert.countDocuments({ customerId, type: 'bulk_export', createdAt: { $gte: last7d } })
      },
      recentActivity: recentActivity.map(a => ({
        id: a._id,
        platform: a.platform,
        appName: a.appName,
        action: a.action,
        recordCount: a.recordCount,
        timestamp: a.timestamp,
        isAnomaly: a.isAnomaly,
        anomalyScore: a.anomalyScore
      })),
      unresolvedAlerts: unresolvedAlerts.map(a => ({
        id: a._id,
        severity: a.severity,
        type: a.type,
        platform: a.platform,
        appName: a.appName,
        description: a.description,
        createdAt: a.createdAt
      })),
      connectedPlatforms: customer?.integrations?.map(i => i.platform) || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resolve an alert
router.patch('/alerts/:id/resolve', requireAuth, async (req, res) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, customerId: req.customerId },
      { resolved: true },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
