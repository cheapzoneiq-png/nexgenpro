require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const cron = require('node-cron');

const authRoutes = require('./routes/auth');
const hubspotRoutes = require('./routes/hubspot');
const salesforceRoutes = require('./routes/salesforce');
const activityRoutes = require('./routes/activity');
const alertRoutes = require('./routes/alerts');
const dashboardRoutes = require('./routes/dashboard');

const { runAnomalyDetection } = require('./services/anomalyDetection');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'https://thebodyguard.co' }));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

// Routes
app.use('/auth', authRoutes);
app.use('/api/hubspot', hubspotRoutes);
app.use('/api/salesforce', salesforceRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexgenpro')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// Run anomaly detection every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Running anomaly detection scan...');
  await runAnomalyDetection();
});

app.listen(PORT, () => {
  console.log(`NexGenPro backend running on port ${PORT}`);
});

module.exports = app;
