import { Router, Request, Response } from 'express';
import { sendSosEmail } from '../services/emailService';

const router = Router();

router.post('/sos', async (req: Request, res: Response) => {
  const {
    userId,
    tripId,
    location,
    timestamp,
    alertType,
    message,
    mode,
    trustedContactEmail,
  } = req.body as {
    userId?: string;
    tripId?: string;
    location?: { lat?: number; lng?: number };
    timestamp?: string;
    alertType?: string;
    message?: string;
    mode?: 'walking' | 'car';
    trustedContactEmail?: string;
  };

  if (!trustedContactEmail || typeof trustedContactEmail !== 'string') {
    console.warn('[alerts/sos] missing trustedContactEmail');
    return res.status(400).json({ ok: false, error: 'trustedContactEmail is required' });
  }

  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    console.warn('[alerts/sos] invalid location', location);
    return res.status(400).json({ ok: false, error: 'location.lat and location.lng are required' });
  }

  try {
    console.log('[alerts/sos] attempting email send', {
      trustedContactEmail,
      tripId,
      alertType,
    });
    const result = await sendSosEmail({
      userId: userId ?? 'unknown-user',
      tripId: tripId ?? 'unknown-trip',
      trustedContactEmail,
      location: { lat: location.lat, lng: location.lng },
      timestamp: timestamp ?? new Date().toISOString(),
      alertType: alertType ?? 'sos',
      message: message ?? 'Emergency alert triggered from SafeWalk.',
      mode: mode === 'car' ? 'car' : 'walking',
    });

    return res.status(200).json({
      ok: true,
      channel: 'email',
      alertId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send email alert';
    console.error('[alerts/sos] send failed', message);
    return res.status(500).json({ ok: false, error: message });
  }
});

export default router;
