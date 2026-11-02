const { ActivityLog, Baseline, Alert, Customer } = require('../models');
const { sendAlert } = require('./alertService');

// Run anomaly detection across all customers
async function runAnomalyDetection() {
  try {
    const customers = await Customer.find({});
    for (const customer of customers) {
      await detectForCustomer(customer._id);
    }
  } catch (err) {
    console.error('Anomaly detection error:', err.message);
  }
}

async function detectForCustomer(customerId) {
  // Get activity from the last 30 minutes (unscanned)
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const recentActivity = await ActivityLog.find({
    customerId,
    timestamp: { $gte: since },
    isAnomaly: false
  });

  for (const activity of recentActivity) {
    const anomalies = await checkForAnomalies(customerId, activity);

    if (anomalies.length > 0) {
      activity.isAnomaly = true;
      activity.anomalyScore = anomalies.reduce((sum, a) => sum + a.score, 0);
      await activity.save();

      // Create alert for each anomaly type
      for (const anomaly of anomalies) {
        const alert = await Alert.create({
          customerId,
          activityLogId: activity._id,
          severity: anomaly.severity,
          type: anomaly.type,
          platform: activity.platform,
          appName: activity.appName,
          description: anomaly.description
        });

        // Send email/SMS alert
        await sendAlert(customerId, alert, activity);
      }
    }
  }
}

async function checkForAnomalies(customerId, activity) {
  const anomalies = [];
  const hour = new Date(activity.timestamp).getHours();

  // 1. After-hours access (outside 6am-10pm)
  if (hour < 6 || hour > 22) {
    anomalies.push({
      type: 'after_hours_access',
      severity: 'medium',
      score: 30,
      description: `${activity.appName} accessed ${activity.platform} at ${hour}:00 — outside normal business hours`
    });
  }

  // 2. Bulk export / high record count
  if (activity.recordCount > 500) {
    anomalies.push({
      type: 'bulk_export',
      severity: activity.recordCount > 2000 ? 'critical' : 'high',
      score: activity.recordCount > 2000 ? 80 : 50,
      description: `${activity.appName} accessed ${activity.recordCount} records in a single operation on ${activity.platform}`
    });
  }

  // 3. Unusual volume vs baseline
  const baseline = await Baseline.findOne({
    customerId,
    platform: activity.platform,
    appName: activity.appName
  });

  if (baseline) {
    // Check if request volume is 3x above normal
    const recentCount = await ActivityLog.countDocuments({
      customerId,
      platform: activity.platform,
      appName: activity.appName,
      timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // last hour
    });

    if (recentCount > baseline.avgDailyRequests * 3) {
      anomalies.push({
        type: 'unusual_volume',
        severity: 'high',
        score: 60,
        description: `${activity.appName} made ${recentCount} requests in the last hour vs baseline of ${baseline.avgDailyRequests}/day`
      });
    }

    // Check if this app normally runs at this hour
    if (baseline.normalHours && !baseline.normalHours.includes(hour)) {
      anomalies.push({
        type: 'unusual_time_pattern',
        severity: 'low',
        score: 20,
        description: `${activity.appName} active at hour ${hour} — not in its normal usage pattern`
      });
    }
  }

  // 4. New/unknown app (no baseline exists yet — first time seen)
  const existingActivity = await ActivityLog.countDocuments({
    customerId,
    platform: activity.platform,
    appName: activity.appName,
    _id: { $ne: activity._id }
  });

  if (existingActivity === 0) {
    anomalies.push({
      type: 'new_integration_detected',
      severity: 'medium',
      score: 40,
      description: `New integration detected: ${activity.appName} connected to ${activity.platform} for the first time`
    });
  }

  return anomalies;
}

// Update baselines weekly (call from cron)
async function updateBaselines() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const pipeline = [
    { $match: { timestamp: { $gte: sevenDaysAgo }, isAnomaly: false } },
    {
      $group: {
        _id: { customerId: '$customerId', platform: '$platform', appName: '$appName' },
        avgDailyRequests: { $avg: '$recordCount' },
        hours: { $push: { $hour: '$timestamp' } }
      }
    }
  ];

  const results = await ActivityLog.aggregate(pipeline);

  for (const r of results) {
    const hourCounts = {};
    r.hours.forEach(h => { hourCounts[h] = (hourCounts[h] || 0) + 1; });
    const normalHours = Object.keys(hourCounts)
      .filter(h => hourCounts[h] > 2)
      .map(Number);

    await Baseline.findOneAndUpdate(
      { customerId: r._id.customerId, platform: r._id.platform, appName: r._id.appName },
      {
        avgDailyRequests: r.avgDailyRequests,
        normalHours,
        lastUpdated: new Date()
      },
      { upsert: true }
    );
  }

  console.log(`Updated ${results.length} baselines`);
}

module.exports = { runAnomalyDetection, updateBaselines };
