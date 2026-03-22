import { Router, Request, Response } from 'express';
import { tripStore } from '../store/tripStore';
import { distanceFromRoute } from '../utils/geometry';
import { classifyDeviation } from '../utils/deviationClassifier';
import { getDeviationConfig } from '../config/deviationConfig';
import { buildTripSummary } from '../services/completionService';

const router = Router();

router.get('/:tripId', (req: Request, res: Response) => {
  const { tripId } = req.params;

  const trip = tripStore.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: 'Trip not found' });
  }

  const now         = Date.now();
  const elapsedMs   = now - trip.startTime.getTime();
  const lastUpdateMs = trip.lastLocationUpdate
    ? now - trip.lastLocationUpdate.getTime()
    : null;

  // ── Completion summary (if trip is done) ───────────────────────────────
  // Rebuild the summary from current trip state so the frontend can fetch
  // it even if it missed the completion event in the update-location response.
  let summary = null;
  if (trip.completedAt !== null && trip.currentLocation !== null) {
    const distRounded    = Math.round(distanceFromRoute(trip.currentLocation, trip.plannedRoute));
    const deviationLevel = classifyDeviation(distRounded, getDeviationConfig(trip.mode));
    summary = buildTripSummary(trip, trip.completedAt, distRounded, deviationLevel);
  }

  return res.json({
    tripId:                 trip.tripId,
    userId:                 trip.userId,
    destination:            trip.destination,
    status:                 trip.status,
    escalated:              trip.escalated,
    tripCompleted:          trip.completedAt !== null,
    summary,
    currentLocation:        trip.currentLocation,
    lastLocationUpdate:     trip.lastLocationUpdate,
    secondsSinceLastUpdate: lastUpdateMs != null ? Math.round(lastUpdateMs / 1000) : null,
    elapsedSeconds:         Math.round(elapsedMs / 1000),
    checkInPending:         trip.checkInSent && !trip.escalated,
    sosTriggered:           trip.sosTriggered,
    dangerWordTriggered:    trip.dangerWordTriggered,
    trustedContact:         trip.trustedContact,
    alertLog:               trip.alertLog,
  });
});

export default router;
