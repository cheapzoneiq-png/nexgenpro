const mongoose = require('mongoose');

// Customer / tenant
const CustomerSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  company: String,
  plan: { type: String, default: 'design_partner' },
  createdAt: { type: Date, default: Date.now },
  integrations: [{
    platform: String, // 'hubspot' | 'salesforce'
    connectedAt: Date,
    accessToken: String,
    refreshToken: String,
    tokenExpiry: Date,
    instanceUrl: String // Salesforce only
  }]
});

// Activity log — every API call made by a connected integration
const ActivityLogSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  platform: String,           // hubspot | salesforce
  appName: String,            // Zapier, Outreach, Apollo, etc.
  action: String,             // read_contacts | export_deals | bulk_query
  recordCount: Number,        // how many records touched
  timestamp: { type: Date, default: Date.now },
  ipAddress: String,
  isAnomaly: { type: Boolean, default: false },
  anomalyScore: { type: Number, default: 0 },
  metadata: mongoose.Schema.Types.Mixed
});

// Baseline — normal behavior pattern per integration per customer
const BaselineSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  platform: String,
  appName: String,
  avgDailyRequests: Number,
  avgRecordsPerRequest: Number,
  normalHours: [Number],       // e.g. [8,9,10,11,12,13,14,15,16,17]
  lastUpdated: { type: Date, default: Date.now }
});

// Alert
const AlertSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  activityLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'ActivityLog' },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  type: String,               // after_hours_access | bulk_export | unusual_volume
  platform: String,
  appName: String,
  description: String,
  resolved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  Customer: mongoose.model('Customer', CustomerSchema),
  ActivityLog: mongoose.model('ActivityLog', ActivityLogSchema),
  Baseline: mongoose.model('Baseline', BaselineSchema),
  Alert: mongoose.model('Alert', AlertSchema)
};
