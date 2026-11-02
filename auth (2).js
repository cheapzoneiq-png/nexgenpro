const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Customer } = require('../models');

// HubSpot OAuth callback
router.get('/hubspot/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  try {
    const axios = require('axios');
    // Exchange code for tokens
    const tokenRes = await axios.post('https://api.hubapi.com/oauth/v1/token', null, {
      params: {
        grant_type: 'authorization_code',
        client_id: process.env.HUBSPOT_CLIENT_ID,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET,
        redirect_uri: process.env.HUBSPOT_REDIRECT_URI,
        code
      }
    });

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // Get HubSpot account info
    const accountRes = await axios.get('https://api.hubapi.com/oauth/v1/access-tokens/' + access_token);
    const { hub_id, user, hub_domain } = accountRes.data;

    // Save or update customer
    let customer = await Customer.findOne({ email: user });
    if (!customer) {
      customer = new Customer({ email: user, company: hub_domain });
    }

    const existingIdx = customer.integrations.findIndex(i => i.platform === 'hubspot');
    const integration = {
      platform: 'hubspot',
      connectedAt: new Date(),
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiry: new Date(Date.now() + expires_in * 1000)
    };

    if (existingIdx >= 0) customer.integrations[existingIdx] = integration;
    else customer.integrations.push(integration);

    await customer.save();

    // Issue JWT session token
    const token = jwt.sign({ customerId: customer._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${token}&connected=hubspot`);

  } catch (err) {
    console.error('HubSpot OAuth error:', err.message);
    res.status(500).json({ error: 'OAuth failed', details: err.message });
  }
});

// Salesforce OAuth callback
router.get('/salesforce/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  try {
    const axios = require('axios');
    const tokenRes = await axios.post(`${process.env.SALESFORCE_LOGIN_URL}/services/oauth2/token`, null, {
      params: {
        grant_type: 'authorization_code',
        client_id: process.env.SALESFORCE_CLIENT_ID,
        client_secret: process.env.SALESFORCE_CLIENT_SECRET,
        redirect_uri: process.env.SALESFORCE_REDIRECT_URI,
        code
      }
    });

    const { access_token, refresh_token, instance_url, id } = tokenRes.data;

    // Get Salesforce user info
    const userRes = await axios.get(id, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const { email, organization_id } = userRes.data;

    let customer = await Customer.findOne({ email });
    if (!customer) {
      customer = new Customer({ email, company: organization_id });
    }

    const existingIdx = customer.integrations.findIndex(i => i.platform === 'salesforce');
    const integration = {
      platform: 'salesforce',
      connectedAt: new Date(),
      accessToken: access_token,
      refreshToken: refresh_token,
      instanceUrl: instance_url,
      tokenExpiry: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
    };

    if (existingIdx >= 0) customer.integrations[existingIdx] = integration;
    else customer.integrations.push(integration);

    await customer.save();

    const token = jwt.sign({ customerId: customer._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${token}&connected=salesforce`);

  } catch (err) {
    console.error('Salesforce OAuth error:', err.message);
    res.status(500).json({ error: 'OAuth failed', details: err.message });
  }
});

module.exports = router;
