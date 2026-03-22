import { Router, Request, Response } from 'express';
import { tripStore } from '../store/tripStore';

type ResponseType = 'ok' | 'sos' | 'danger-word' | 'no-response';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  const { tripId, response }: { tripId: string; response: ResponseType } = req.body;

  if (!tripId || !response) {
    return res.status(400).json({ error: 'tripId and response are required' });
  }

  const trip = tripStore.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: 'Trip not found' });
  }

  const now = new Date();

  switch (response) {
    case 'ok':
      trip.lastResponseTime = now;
      trip.checkInSent = false;
      trip.checkInSentAt = null;
      // Only recover to GREEN if we were not already RED from a hard trigger
      if (!trip.sosTriggered && !trip.dangerWordTriggered) {
        trip.status = 'GREEN';
      }
      trip.alertLog.push(`User responded OK at ${now.toISOString()}`);
      tripStore.set(tripId, trip);
      return res.json({
        status: trip.status,
        escalated: trip.escalated,
        message: 'Check-in cleared. Back to safe state.',
      });

    case 'sos':
      trip.sosTriggered = true;
      trip.status = 'RED';
      trip.escalated = true;
      trip.alertLog.push(`SOS triggered at ${now.toISOString()}`);
      tripStore.set(tripId, trip);
      return res.json({
        status: 'RED',
        escalated: true,
        message: 'SOS received. Alerting trusted contact now.',
      });

    case 'danger-word':
      trip.dangerWordTriggered = true;
      trip.status = 'RED';
      trip.escalated = true;
      trip.alertLog.push(`Danger word triggered at ${now.toISOString()}`);
      tripStore.set(tripId, trip);
      return res.json({
        status: 'RED',
        escalated: true,
        message: 'Danger word detected. Alerting trusted contact now.',
      });

    case 'no-response':
      trip.status = 'RED';
      trip.escalated = true;
      trip.alertLog.push(`No response to check-in at ${now.toISOString()}`);
      tripStore.set(tripId, trip);
      return res.json({
        status: 'RED',
        escalated: true,
        message: 'No response recorded. Alerting trusted contact now.',
      });

    default:
      return res.status(400).json({
        error: 'Invalid response type. Accepted: ok | sos | danger-word | no-response',
      });
  }
});

export default router;
