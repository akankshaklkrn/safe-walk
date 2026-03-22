import nodemailer from 'nodemailer';
import { env } from '../config/env';

export interface SosEmailPayload {
  userId: string;
  tripId: string;
  trustedContactEmail: string;
  location: { lat: number; lng: number };
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
  });
  const mapsLink = `https://www.google.com/maps?q=${payload.location.lat},${payload.location.lng}`;
  const subject = `SafeWalk alert: ${payload.alertType.toUpperCase()} for trip ${payload.tripId}`;
  const text = [
    'SafeWalk emergency alert',
    '',
    `User: ${payload.userId}`,
    `Trip ID: ${payload.tripId}`,
    `Mode: ${payload.mode}`,
    `Reason: ${payload.message}`,
    `Timestamp: ${payload.timestamp}`,
    `Location: ${payload.location.lat}, ${payload.location.lng}`,
    `Map: ${mapsLink}`,
  ].join('\n');

  const info = await getTransporter().sendMail({
    from: env.SMTP_FROM,
    to: payload.trustedContactEmail,
    subject,
    text,
    html: `
      <p><strong>SafeWalk emergency alert</strong></p>
      <p><strong>User:</strong> ${payload.userId}</p>
      <p><strong>Trip ID:</strong> ${payload.tripId}</p>
      <p><strong>Mode:</strong> ${payload.mode}</p>
      <p><strong>Reason:</strong> ${payload.message}</p>
      <p><strong>Timestamp:</strong> ${payload.timestamp}</p>
      <p><strong>Location:</strong> ${payload.location.lat}, ${payload.location.lng}</p>
      <p><a href="${mapsLink}">Open live location in Google Maps</a></p>
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
