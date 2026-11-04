const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Customer, ActivityLog } = require('./models');
const { requireAuth } = require('./auth');

// Generate Salesforce OAuth URL
router.get('/connect', (req, res) => {
  const scopes = 'api refresh_token offline_access';
  const url = `${process.env.SALESFORCE_LOGIN_URL}/services/oauth2/authorize?response_type=code&client_id=${process.env.SALESFORCE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.SALESFORCE_REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}`;
  res.json({ url });
});

// Get connected third-party apps in Salesforce org
router.get('/connected-apps', requireAuth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customerId);
    const integration = customer.integrations.find(i => i.platform === 'salesforce');
    if (!integration) return res.status(404).json({ error: 'Salesforce not connected' });

    const token = await refreshSalesforceToken(customer, integration);

    // Query connected apps via Salesforce REST API
    const appsRes = await axios.get(
      `${integration.instanceUrl}/services/data/v58.0/query?q=SELECT+Id,ConnectedApp.Name,UserId,CreatedDate+FROM+ConnectedApplication`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({ apps: appsRes.data.records || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pull Salesforce Event Log Files (the real audit trail)
router.post('/sync-activity', requireAuth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customerId);
    const integration = customer.integrations.find(i => i.platform === 'salesforce');
    if (!integration) return res.status(404).json({ error: 'Salesforce not connected' });

    const token = await refreshSalesforceToken(customer, integration);

    // Query EventLogFile — this is where Salesforce logs all API activity
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const logsRes = await axios.get(
      `${integration.instanceUrl}/services/data/v58.0/query?q=SELECT+Id,EventType,LogDate,LogFileLength+FROM+EventLogFile+WHERE+LogDate>${yesterday}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const logFiles = logsRes.data.records || [];
    let totalLogged = 0;

    for (const logFile of logFiles) {
      // Download the actual log CSV
      const fileRes = await axios.get(
        `${integration.instanceUrl}${logFile.LogFile}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Parse CSV rows (simplified — real version uses csv-parse)
      const rows = fileRes.data.split('\n').slice(1); // skip header
      for (const row of rows.slice(0, 50)) { // cap at 50 per file for now
        if (!row.trim()) continue;
        const cols = row.split(',');

        await ActivityLog.create({
          customerId: customer._id,
          platform: 'salesforce',
          appName: cols[3] || 'Unknown App', // CLIENT_NAME column
          action: logFile.EventType,
          recordCount: parseInt(cols[5]) || 1,
          timestamp: new Date(cols[0] || Date.now()),
          metadata: {
            logFileId: logFile.Id,
            userId: cols[1],
            sessionKey: cols[2]
          }
        });
        totalLogged++;
      }
    }

    res.json({ message: `Synced ${totalLogged} activity events from ${logFiles.length} log files` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Refresh Salesforce token
async function refreshSalesforceToken(customer, integration) {
  if (new Date() < new Date(integration.tokenExpiry)) {
    return integration.accessToken;
  }

  const tokenRes = await axios.post(`${process.env.SALESFORCE_LOGIN_URL}/services/oauth2/token`, null, {
    params: {
      grant_type: 'refresh_token',
      client_id: process.env.SALESFORCE_CLIENT_ID,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET,
      refresh_token: integration.refreshToken
    }
  });

  integration.accessToken = tokenRes.data.access_token;
  integration.tokenExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000);
  await customer.save();

  return integration.accessToken;
}

module.exports = router;
