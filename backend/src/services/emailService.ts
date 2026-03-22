import nodemailer from 'nodemailer';
import { env } from '../config/env';

export interface SosEmailPayload {
  userId: string;
  tripId: string;
  userName?: string;
  trustedContactEmail: string;
  location: { lat: number; lng: number };
  timestamp: string;
  alertType: string;
  message: string;
  mode: 'walking' | 'car';
  originLabel?: string;
  destinationLabel?: string;
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
  const subject = `SafeWalk alert for ${payload.userName || payload.userId}`;
  const introParagraph = `${payload.userName || 'A SafeWalk user'} may need attention right now. SafeWalk detected a critical event during an active trip and is sharing the latest trip details below so you can check in quickly.`;
  const text = [
    'SafeWalk emergency alert',
    '',
    introParagraph,
    '',
    `User: ${payload.userName || payload.userId}`,
    `Map: ${mapsLink}`,
    `Reason: ${payload.message}`,
    `Origin: ${payload.originLabel || 'Not available'}`,
    `Destination: ${payload.destinationLabel || 'Not available'}`,
    `Mode: ${payload.mode}`,
    `Alert type: ${payload.alertType}`,
    `Timestamp: ${payload.timestamp}`,
    `User ID: ${payload.userId}`,
    `Trip ID: ${payload.tripId}`,
    `Location: ${payload.location.lat}, ${payload.location.lng}`,
    '',
    'Please try to contact them as soon as possible. If you believe they are in immediate danger, contact local emergency services.',
  ].join('\n');

  const info = await getTransporter().sendMail({
    from: env.SMTP_FROM,
    to: payload.trustedContactEmail,
    subject,
    text,
    html: `
      <p><strong>SafeWalk emergency alert</strong></p>
      <p>${introParagraph}</p>
      <p><strong>User:</strong> ${payload.userName || payload.userId}</p>
      <p><strong>User ID:</strong> ${payload.userId}</p>
      <p><strong>Trip ID:</strong> ${payload.tripId}</p>
      <p><strong>Mode:</strong> ${payload.mode}</p>
      <p><strong>Origin:</strong> ${payload.originLabel || 'Not available'}</p>
      <p><strong>Destination:</strong> ${payload.destinationLabel || 'Not available'}</p>
      <p><strong>Alert type:</strong> ${payload.alertType}</p>
      <p><strong>Reason:</strong> ${payload.message}</p>
      <p><strong>Timestamp:</strong> ${payload.timestamp}</p>
      <p><strong>Location:</strong> ${payload.location.lat}, ${payload.location.lng}</p>
      <p><a href="${mapsLink}">Open live location in Google Maps</a></p>
      <p>Please try to contact them as soon as possible. If you believe they are in immediate danger, contact local emergency services.</p>
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
