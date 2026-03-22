import { Trip, TripStatus } from '../types/trip';
import { RISK } from '../config/constants';
import { distanceFromRoute } from '../utils/geometry';

// Re-export so existing imports of distanceFromRoute from this file keep working
export { distanceFromRoute } from '../utils/geometry';

export interface RiskResult {
  status: TripStatus;
  reason: string;
  checkInRequired: boolean;
}

/**
 * How long after trip start to skip route deviation checks.
 *
 * Why this is needed:
 *   Google Maps road-snaps waypoints to the nearest road, which can be 30–80m
 *   away from the raw GPS origin the user provided. On walking mode the YELLOW
 *   deviation threshold is only 50m, so the very first location poll — before
 *   the user has taken a single step — often reads as "off route" and fires a
 *   false check-in prompt.
 *
 *   During the grace period we still honour SOS, danger words, and check-in
 *   timeouts (which can be triggered at any time), but we skip the geometric
 *   deviation check until the user has had time to actually start moving.
 */
const DEVIATION_GRACE_PERIOD_MS = 60_000; // 60 seconds

export function evaluateRisk(trip: Trip): RiskResult {
  const now = Date.now();
  const thresholds = RISK[trip.mode];

  // Immediate RED: explicit triggers already set on the trip
  if (trip.sosTriggered) {
    return { status: 'RED', reason: 'SOS triggered', checkInRequired: false };
  }
  if (trip.dangerWordTriggered) {
    return { status: 'RED', reason: 'Danger word detected', checkInRequired: false };
  }

  // Check-in sent but user did not respond within timeout
  if (trip.checkInSent && trip.checkInSentAt) {
    const elapsed = now - trip.checkInSentAt.getTime();
    if (elapsed > thresholds.CHECKIN_TIMEOUT_MS) {
      return { status: 'RED', reason: 'No response to check-in prompt', checkInRequired: false };
    }
  }

  // Inactivity
  if (trip.lastLocationUpdate) {
    const inactiveMs = now - trip.lastLocationUpdate.getTime();
    if (inactiveMs > thresholds.INACTIVITY_RED_MS) {
      return {
        status: 'RED',
        reason: `No location update for ${Math.round(inactiveMs / 60000)} minutes`,
        checkInRequired: false,
      };
    }
    if (inactiveMs > thresholds.INACTIVITY_YELLOW_MS) {
      return {
        status: 'YELLOW',
        reason: `No location update for ${Math.round(inactiveMs / 60000)} minutes`,
        checkInRequired: true,
      };
    }
  }

  // Route deviation — skipped during the grace period at trip start.
  // Uses segment-based geometry (Milestone 3) for accuracy.
  const tripAgeMs = now - trip.startTime.getTime();
  if (tripAgeMs >= DEVIATION_GRACE_PERIOD_MS && trip.currentLocation) {
    const dist = distanceFromRoute(trip.currentLocation, trip.plannedRoute);
    if (dist > thresholds.DEVIATION_RED_M) {
      return {
        status: 'RED',
        reason: `Route deviation of ${Math.round(dist)}m detected`,
        checkInRequired: false,
      };
    }
    if (dist > thresholds.DEVIATION_YELLOW_M) {
      return {
        status: 'YELLOW',
        reason: `Moderate deviation from route (${Math.round(dist)}m)`,
        checkInRequired: true,
      };
    }
  }

  const reason = tripAgeMs < DEVIATION_GRACE_PERIOD_MS ? 'Starting up…' : 'All clear';
  return { status: 'GREEN', reason, checkInRequired: false };
}

export function shouldEscalate(trip: Trip): boolean {
  if (trip.sosTriggered || trip.dangerWordTriggered) return true;
  if (trip.checkInSent && trip.checkInSentAt) {
    return Date.now() - trip.checkInSentAt.getTime() > RISK[trip.mode].CHECKIN_TIMEOUT_MS;
  }
  return false;
}
