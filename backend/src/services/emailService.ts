import nodemailer from 'nodemailer';
import { env } from '../config/env';

export interface SosEmailPayload {
  userId: string;
  userName: string;
  tripId: string;
  trustedContactEmail: string;
  location: { lat: number; lng: number };
  originLabel: string;
  destinationLabel: string;
  timestamp: string;
  alertType: string;
  message: string;
  mode: 'walking' | 'car';
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM) {
    console.error('[emailService] SMTP configuration is incomplete', {
      hasHost: Boolean(env.SMTP_HOST),
      hasUser: Boolean(env.SMTP_USER),
      hasPass: Boolean(env.SMTP_PASS),
      hasFrom: Boolean(env.SMTP_FROM),
      port: env.SMTP_PORT,
    });
    throw new Error('SMTP configuration is incomplete');
  }

  if (!transporter) {
    console.log('[emailService] creating transporter', {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      from: env.SMTP_FROM,
    });
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  return transporter;
}

export async function sendSosEmail(payload: SosEmailPayload) {
  console.log('[emailService] sendSosEmail called', {
    tripId: payload.tripId,
    to: payload.trustedContactEmail,
    alertType: payload.alertType,
    userName: payload.userName,
  });
  const mapsLink = `https://www.google.com/maps?q=${payload.location.lat},${payload.location.lng}`;
  const subject = `SafeWalk alert: ${payload.userName} may need help`;
  const text = [
    'SafeWalk emergency alert',
    '',
    `${payload.userName} may need assistance right now. SafeWalk detected a critical event during the trip and is sharing the latest trip details below so you can check in quickly.`,
    '',
    `User: ${payload.userName}`,
    `User ID: ${payload.userId}`,
    `Trip ID: ${payload.tripId}`,
    `Mode: ${payload.mode}`,
    `Origin: ${payload.originLabel}`,
    `Destination: ${payload.destinationLabel}`,
    `Reason: ${payload.message}`,
    `Alert type: ${payload.alertType}`,
    `Timestamp: ${payload.timestamp}`,
    `Latest known location: ${payload.location.lat}, ${payload.location.lng}`,
    `Map: ${mapsLink}`,
    '',
    'If you cannot reach them promptly, please consider contacting local emergency services or someone nearby who can help.',
  ].join('\n');

  const info = await getTransporter().sendMail({
    from: env.SMTP_FROM,
    to: payload.trustedContactEmail,
    subject,
    text,
    html: `
      <p><strong>SafeWalk emergency alert</strong></p>
      <p>${payload.userName} may need assistance right now. SafeWalk detected a critical event during the trip and is sharing the latest trip details below so you can check in quickly.</p>
      <p><strong>User:</strong> ${payload.userName}</p>
      <p><strong>Mode:</strong> ${payload.mode}</p>
      <p><strong>Origin:</strong> ${payload.originLabel}</p>
      <p><strong>Destination:</strong> ${payload.destinationLabel}</p>
      <p><strong>Reason:</strong> ${payload.message}</p>
      <p><strong>Alert type:</strong> ${payload.alertType}</p>
      <p><strong>Timestamp:</strong> ${payload.timestamp}</p>
      <p><strong>Latest known location:</strong> ${payload.location.lat}, ${payload.location.lng}</p>
      <p><a href="${mapsLink}">Open live location in Google Maps</a></p>
      <p>If you cannot reach them promptly, please consider contacting local emergency services or someone nearby who can help.</p>
    `,
  });
  console.log('[emailService] sendMail result', {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  };
}
