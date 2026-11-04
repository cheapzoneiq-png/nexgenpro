const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  company: { type: String },
  hubspotId: { type: String },
  salesforceId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const activityLogSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  type: { type: String, required: true },
  description: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now }
});

const baselineSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  metric: { type: String, required: true },
  value: { type: Number },
  calculatedAt: { type: Date, default: Date.now }
});

const alertSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  type: { type: String, required: true },
  message: { type: String },
  severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  resolved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Customer = mongoose.model('Customer', customerSchema);
const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
const Baseline = mongoose.model('Baseline', baselineSchema);
const Alert = mongoose.model('Alert', alertSchema);

module.exports = { Customer, ActivityLog, Baseline, Alert };
