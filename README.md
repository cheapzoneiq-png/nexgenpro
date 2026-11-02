# NexGenPro Dynamics — Backend

Real-time CRM security monitoring. Watches what connected apps do inside HubSpot and Salesforce.

## Stack
- Node.js / Express
- MongoDB (Mongoose)
- HubSpot OAuth + Salesforce OAuth
- Anomaly detection engine (runs every 5 min)
- Email alerts via Nodemailer

## Setup

```bash
npm install
cp .env.example .env
# Fill in your credentials in .env
npm run dev
```

## What this does

1. **OAuth Connect** — Customer connects HubSpot or Salesforce via OAuth
2. **Activity Sync** — Pulls audit logs from both platforms every cycle
3. **Anomaly Detection** — Checks every event for:
   - After-hours access (outside 6am–10pm)
   - Bulk exports (500+ records)
   - Unusual volume vs 7-day baseline
   - New/unknown integrations appearing
4. **Alerts** — Fires email alerts to customer + richard@nexgenpro.org

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | /auth/hubspot/callback | HubSpot OAuth callback |
| GET | /auth/salesforce/callback | Salesforce OAuth callback |
| GET | /api/hubspot/connect | Get HubSpot OAuth URL |
| GET | /api/salesforce/connect | Get Salesforce OAuth URL |
| POST | /api/hubspot/sync-activity | Pull HubSpot audit logs |
| POST | /api/salesforce/sync-activity | Pull Salesforce event logs |
| GET | /api/dashboard/stats | Dashboard data |
| GET | /api/activity | Activity log |
| GET | /api/alerts | Alert list |

## Hand this to your Upwork developer

Tell them:
- Node.js backend, deploy to Railway or Render (free tier)
- MongoDB Atlas (free tier)
- Need HubSpot App + Salesforce Connected App credentials
- Frontend at thebodyguard.co calls these APIs
