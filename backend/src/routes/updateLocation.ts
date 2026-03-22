import { Router, Request, Response } from 'express';
import { tripStore } from '../store/tripStore';
import { evaluateRisk, shouldEscalate } from '../logic/riskEngine';
import { distanceFromRoute } from '../utils/geometry';
import { classifyDeviation } from '../utils/deviationClassifier';
import { getDeviationConfig } from '../config/deviationConfig';
import { detectRecovery } from '../utils/recoveryDetector';
import { isDestinationReached, buildTripSummary } from '../services/completionService';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  const { tripId, lat, lng } = req.body;

  if (!tripId || lat == null || lng == null) {
    return res.status(400).json({ error: 'tripId, lat, and lng are required' });
  }

  const trip = tripStore.get(tripId);
  if (!trip) {
    return res.status(404).json({ error: 'Trip not found' });
  }

  // Short-circuit: once escalated, no further processing needed
  if (trip.escalated) {
    return res.json({
      status:           'RED',
      reason:           'Trip already escalated',
      escalated:        true,
      checkInRequired:  false,
      rejoinedRoute:    false,
      tripCompleted:    false,
      summary:          null,
    });
  }

  const now = new Date();
  trip.currentLocation   = { lat, lng };
  trip.lastLocationUpdate = now;

  // ── Deviation classification (shared by risk + recovery + completion) ───
  // Compute once here so every sub-system uses the same value this frame.
  const distM          = distanceFromRoute({ lat, lng }, trip.plannedRoute);
  const distRounded    = Math.round(distM);
  const deviationLevel = classifyDeviation(
    distRounded,
    getDeviationConfig(trip.mode),
  );

  // ── Risk evaluation (inactivity, SOS, danger word, deviation) ──────────
  const { status, reason, checkInRequired } = evaluateRisk(trip);
  trip.status = status;

  if (checkInRequired && !trip.checkInSent) {
    trip.checkInSent   = true;
    trip.checkInSentAt = now;
    trip.alertLog.push(`Check-in prompt sent at ${now.toISOString()} — ${reason}`);
  }

  if (shouldEscalate(trip) && !trip.escalated) {
    trip.escalated = true;
    trip.alertLog.push(`ESCALATED at ${now.toISOString()} — ${reason}`);
  }

  // ── Recovery detection (Milestone 6) ───────────────────────────────────
  const { rejoinedRoute, newConsecutiveOnRouteCount, newWasOffRoute } =
    detectRecovery(
      deviationLevel,
      trip.consecutiveOnRouteCount,
      trip.wasOffRoute,
    );

  trip.consecutiveOnRouteCount = newConsecutiveOnRouteCount;
  trip.wasOffRoute              = newWasOffRoute;

  if (rejoinedRoute) {
    trip.alertLog.push(`User rejoined route at ${now.toISOString()}`);
    trip.checkInSent   = false;
    trip.checkInSentAt = null;
  }

  // ── Completion detection (Milestone 7) ─────────────────────────────────
  // If the trip was already completed on a previous update, re-return the
  // cached summary without recomputing. This handles duplicate polls from
  // the frontend after the completion screen is shown.
  if (trip.completedAt !== null) {
    const cachedSummary = buildTripSummary(
      trip,
      trip.completedAt,
      distRounded,
      deviationLevel,
    );

    tripStore.set(tripId, trip);
    return res.json({
      status:          'GREEN',
      reason:          'Trip already completed',
      checkInRequired: false,
      escalated:       trip.escalated,
      deviationLevel,
      rejoinedRoute:   false,
      tripCompleted:   true,
      summary:         cachedSummary,
      currentLocation: trip.currentLocation,
      timestamp:       now.toISOString(),
    });
  }

  // First-time completion check: is the user within the arrival radius?
  const arrived = isDestinationReached(
    { lat, lng },
    trip.endLocation,
    trip.mode,
  );

  let tripCompleted = false;
  let summary       = null;

  if (arrived) {
    tripCompleted    = true;
    trip.completedAt = now;
    trip.status      = 'GREEN';   // override to GREEN — a clean arrival

    summary = buildTripSummary(trip, now, distRounded, deviationLevel);

    trip.alertLog.push(
      `Trip completed at ${now.toISOString()} — ` +
      `duration ${summary.actualDurationMinutes} min, ` +
      `final deviation ${distRounded}m (${deviationLevel})`,
    );
  }

  tripStore.set(tripId, trip);

  return res.json({
    status:          arrived ? 'GREEN' : status,
    reason:          arrived ? 'Destination reached' : reason,
    checkInRequired: arrived ? false : checkInRequired,
    escalated:       trip.escalated,
    deviationLevel,
    rejoinedRoute,
    tripCompleted,
    summary,
    currentLocation: trip.currentLocation,
    timestamp:       now.toISOString(),
  });
});

export default router;
