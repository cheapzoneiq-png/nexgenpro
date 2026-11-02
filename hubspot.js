const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Customer, ActivityLog } = require('../models');
const { requireAuth } = require('../middleware/auth');

// Generate HubSpot OAuth URL
router.get('/connect', (req, res) => {
  const scopes = 'contacts crm.objects.contacts.read crm.objects.deals.read oauth';
  const url = `https://app.hubspot.com/oauth/authorize?client_id=${process.env.HUBSPOT_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.HUBSPOT_REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}`;
  res.json({ url });
});

// Fetch connected apps / integrations in HubSpot account
router.get('/connected-apps', requireAuth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customerId);
    const integration = customer.integrations.find(i => i.platform === 'hubspot');
    if (!integration) return res.status(404).json({ error: 'HubSpot not connected' });

    const token = await refreshHubSpotToken(customer, integration);

    // Get installed integrations via HubSpot API
    const appsRes = await axios.get('https://api.hubapi.com/integrations/v1/me/cards', {
      headers: { Authorization: `Bearer ${token}` }
    });

    res.json({ apps: appsRes.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pull recent activity from HubSpot and log it
router.post('/sync-activity', requireAuth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customerId);
    const integration = customer.integrations.find(i => i.platform === 'hubspot');
    if (!integration) return res.status(404).json({ error: 'HubSpot not connected' });

    const token = await refreshHubSpotToken(customer, integration);

    // Pull recent contact reads (audit log)
    const auditRes = await axios.get('https://api.hubapi.com/cms/v3/audit-logs/', {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 100, objectType: 'CONTACT' }
    });

    const logs = auditRes.data.results || [];
    let logged = 0;

    for (const entry of logs) {
      const exists = await ActivityLog.findOne({
        customerId: customer._id,
        platform: 'hubspot',
        'metadata.eventId': entry.id
      });
      if (exists) continue;

      await ActivityLog.create({
        customerId: customer._id,
        platform: 'hubspot',
        appName: entry.userId || 'HubSpot User',
        action: entry.event,
        recordCount: 1,
        timestamp: new Date(entry.timestamp),
        metadata: { eventId: entry.id, objectType: entry.objectType }
      });
      logged++;
    }

    res.json({ message: `Synced ${logged} new activity events` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Refresh access token if needed
async function refreshHubSpotToken(customer, integration) {
  if (new Date() < new Date(integration.tokenExpiry)) {
    return integration.accessToken;
  }

  const tokenRes = await axios.post('https://api.hubapi.com/oauth/v1/token', null, {
    params: {
      grant_type: 'refresh_token',
      client_id: process.env.HUBSPOT_CLIENT_ID,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET,
      refresh_token: integration.refreshToken
    }
  });

  integration.accessToken = tokenRes.data.access_token;
  integration.tokenExpiry = new Date(Date.now() + tokenRes.data.expires_in * 1000);
  await customer.save();

  return integration.accessToken;
}

module.exports = router;
