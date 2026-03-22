require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const port = Number(process.env.BACKEND_PORT || 3001);
const alertProvider = (process.env.ALERT_PROVIDER || 'email').toLowerCase();

app.use(cors());
app.use(express.json());

function buildGoogleMapsLink(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Latitude and longitude must be valid numbers.');
  }

  if (lat < -90 || lat > 90) {
    throw new Error('Latitude must be between -90 and 90.');
  }

  if (lng < -180 || lng > 180) {
    throw new Error('Longitude must be between -180 and 180.');
  }

  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function isLikelyEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'undefined') {
    return fallback;
  }
  return String(value).toLowerCase() === 'true';
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'safewalk-local-backend' });
});

app.post('/alerts/sos', async (req, res) => {
  try {
    const payload = req.body || {};
    const lat = Number(payload?.location?.lat);
    const lng = Number(payload?.location?.lng);
    const userId = payload?.userId || 'unknown-user';
    const tripId = payload?.tripId || 'unknown-trip';
    const emergencyContactName = process.env.EMERGENCY_CONTACT_NAME || 'Trusted Contact';
    const emergencyContactEmail = String(
      payload?.trustedContactEmail || process.env.EMERGENCY_CONTACT_EMAIL || ''
    ).trim();

    if (alertProvider !== 'email') {
      return res.status(400).json({
        ok: false,
        alertId: `alert-${Date.now()}`,
        smsSent: false,
        mapLink: '',
        fallbackUsed: true,
        error: `Unsupported ALERT_PROVIDER: ${alertProvider}. Set ALERT_PROVIDER=email in .env.`,
      });
    }

    if (!emergencyContactEmail) {
      return res.status(400).json({
        ok: false,
        alertId: `alert-${Date.now()}`,
        smsSent: false,
        mapLink: '',
        fallbackUsed: true,
        error:
          'Missing recipient email. Provide trustedContactEmail in request or set EMERGENCY_CONTACT_EMAIL in .env.',
      });
    }

    if (!isLikelyEmail(emergencyContactEmail)) {
      return res.status(400).json({
        ok: false,
        alertId: `alert-${Date.now()}`,
        smsSent: false,
        mapLink: '',
        fallbackUsed: true,
        error: `Invalid email format for EMERGENCY_CONTACT_EMAIL: ${emergencyContactEmail}.`,
      });
    }

    const mapLink = buildGoogleMapsLink(lat, lng);
    const body = [
      `SafeWalk SOS alert for ${userId}.`,
      payload?.message || 'Emergency alert triggered.',
      `Emergency contact: ${emergencyContactName}.`,
      `Trip: ${tripId}.`,
      `Current location: ${mapLink}`,
    ].join(' ');

    const smtpHost = requireEnv('EMAIL_SMTP_HOST');
    const smtpPort = Number(process.env.EMAIL_SMTP_PORT || 587);
    const smtpSecure = parseBoolean(process.env.EMAIL_SMTP_SECURE, false);
    const smtpUser = requireEnv('EMAIL_SMTP_USER');
    const smtpPass = requireEnv('EMAIL_SMTP_PASS');
    const emailFrom = requireEnv('EMAIL_FROM');

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const emailInfo = await transporter.sendMail({
      from: emailFrom,
      to: emergencyContactEmail,
      subject: `SafeWalk SOS Alert - ${userId}`,
      text: `${body}\n\nMap link: ${mapLink}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>SafeWalk SOS Alert</h2>
          <p><strong>User:</strong> ${userId}</p>
          <p><strong>Message:</strong> ${payload?.message || 'Emergency alert triggered.'}</p>
          <p><strong>Trip:</strong> ${tripId}</p>
          <p><strong>Emergency Contact:</strong> ${emergencyContactName}</p>
          <p>
            <strong>Current Location:</strong>
            <a href="${mapLink}" target="_blank" rel="noopener noreferrer">${mapLink}</a>
          </p>
        </div>
      `,
    });

    return res.json({
      ok: true,
      alertId: emailInfo.messageId || `email-${Date.now()}`,
      smsSent: true,
      mapLink,
      fallbackUsed: false,
      channel: 'email',
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      alertId: `alert-${Date.now()}`,
      smsSent: false,
      mapLink: '',
      fallbackUsed: true,
      error: `${error.message || 'Failed to send SOS alert.'} Check provider configuration in .env.`,
    });
  }
});

app.listen(port, () => {
  console.log(
    `SafeWalk local backend running on http://localhost:${port} (provider: ${alertProvider})`
  );
});
