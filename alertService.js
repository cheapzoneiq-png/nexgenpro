const nodemailer = require('nodemailer');
const { Customer } = require('../models');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendAlert(customerId, alert, activity) {
  try {
    const customer = await Customer.findById(customerId);
    if (!customer) return;

    const severityColors = {
      low: '#f59e0b',
      medium: '#f97316',
      high: '#ef4444',
      critical: '#7c3aed'
    };

    const color = severityColors[alert.severity] || '#ef4444';
    const time = new Date(activity.timestamp).toLocaleString();

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0A1628; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #00C896; margin: 0; font-size: 20px;">🛡 NexGenPro Security Alert</h1>
        </div>
        <div style="background: #f8f8fc; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0ef;">
          <div style="background: ${color}20; border-left: 4px solid ${color}; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;">
            <strong style="color: ${color}; text-transform: uppercase; font-size: 12px;">${alert.severity} severity — ${alert.type.replace(/_/g, ' ')}</strong>
          </div>

          <p style="font-size: 16px; color: #1a1a2e; margin-bottom: 16px;">${alert.description}</p>

          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="border-bottom: 1px solid #e0e0ef;">
              <td style="padding: 8px; color: #7a7a9a; width: 40%;">Platform</td>
              <td style="padding: 8px; color: #1a1a2e; font-weight: 600; text-transform: capitalize;">${activity.platform}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e0e0ef;">
              <td style="padding: 8px; color: #7a7a9a;">App / Integration</td>
              <td style="padding: 8px; color: #1a1a2e; font-weight: 600;">${activity.appName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e0e0ef;">
              <td style="padding: 8px; color: #7a7a9a;">Action</td>
              <td style="padding: 8px; color: #1a1a2e;">${activity.action}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e0e0ef;">
              <td style="padding: 8px; color: #7a7a9a;">Records Accessed</td>
              <td style="padding: 8px; color: #1a1a2e;">${activity.recordCount?.toLocaleString() || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; color: #7a7a9a;">Time Detected</td>
              <td style="padding: 8px; color: #1a1a2e;">${time}</td>
            </tr>
          </table>

          <div style="margin-top: 24px;">
            <a href="${process.env.FRONTEND_URL}/dashboard"
               style="background: #0A1628; color: #00C896; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              View Dashboard →
            </a>
          </div>

          <p style="font-size: 12px; color: #7a7a9a; margin-top: 24px;">
            NexGenPro Dynamics · thebodyguard.co · hello@nexgenpro.org
          </p>
        </div>
      </div>
    `;

    // Send to customer
    await transporter.sendMail({
      from: `"NexGenPro Security" <${process.env.ALERT_EMAIL_FROM}>`,
      to: customer.email,
      subject: `🚨 [${alert.severity.toUpperCase()}] ${alert.type.replace(/_/g, ' ')} detected on ${activity.platform}`,
      html
    });

    // Also notify Richard
    await transporter.sendMail({
      from: `"NexGenPro Alerts" <${process.env.ALERT_EMAIL_FROM}>`,
      to: process.env.ALERT_EMAIL_TO,
      subject: `[CUSTOMER ALERT] ${customer.email} — ${alert.type} on ${activity.platform}`,
      html: `<p>Customer: ${customer.email} (${customer.company})</p>${html}`
    });

    console.log(`Alert sent to ${customer.email}: ${alert.type}`);
  } catch (err) {
    console.error('Alert send error:', err.message);
  }
}

module.exports = { sendAlert };
