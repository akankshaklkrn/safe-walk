/**
 * tripUpdateService.ts — Milestones 4 + 5
 *
 * Takes a live device location + active TripSession and returns a fully
 * normalized TripUpdate with 4-level deviation classification (Milestone 5).
 *
 * Dependency chain:
 *   geometry.ts          → raw maths (distance, progress)
 *   deviationConfig.ts   → configurable thresholds per mode
 *   deviationClassifier.ts → classify distance → DeviationLevel
 *   tripUpdateService.ts → assemble TripUpdate (this file)
 *
 * This function has no side effects. It is the single place Milestone 6
 * (escalation) calls to decide whether to fire an alert.
 */

import { LatLng } from '../types/maps';
import { TripSession } from '../types/session';
import { TripUpdate } from '../types/tripUpdate';
import {
  distanceFromRoute,
  progressAlongRoute,
  haversineDistance,
} from '../utils/geometry';
import {
  classifyDeviation,
  deviationLevelToStatus,
  deviationLevelToReason,
  deviationRequiresCheckIn,
} from '../utils/deviationClassifier';
import { getDeviationConfig } from '../config/deviationConfig';

// ---------------------------------------------------------------------------
// Destination-reached threshold (unrelated to deviation, so kept separate)
// ---------------------------------------------------------------------------

const DESTINATION_THRESHOLD_M: Record<string, number> = {
  walking: 30,  // ~3–4 steps from the endpoint
  car:     80,  // parking spot / drop-off zone radius
};

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Calculates a complete TripUpdate from a single live location reading.
 *
 * @param session         Active TripSession from tripStore.
 *                        Provides waypoints, mode, ETA, and destination.
 * @param currentLocation Device GPS coordinates at this moment.
 * @param timestamp       When the reading was taken (defaults to now).
 *
 * Hackathon simplifications (documented for transparency):
 *   - Progress is linear: remainingEta = expectedEta × (1 − progress).
 *   - Destination is a fixed-radius circle around the route endpoint.
 *   - Deviation is geometric only — no time-based component.
 */
export function updateTripLocation(
  session: TripSession,
  currentLocation: LatLng,
  timestamp: Date = new Date(),
): TripUpdate {
  const { waypoints, mode, expectedEtaMinutes, endLocation } = session;

  // ── 1. Distance from route (segment-based, Milestone 3) ────────────────
  const distanceFromRouteMeters = Math.round(
    distanceFromRoute(currentLocation, waypoints),
  );

  // ── 2. Deviation classification (Milestone 5) ───────────────────────────
  // Convert raw metres into a named level using mode-aware thresholds.
  const deviationConfig = getDeviationConfig(mode);
  const deviationLevel  = classifyDeviation(distanceFromRouteMeters, deviationConfig);

  // ── 3. Progress along route ─────────────────────────────────────────────
  const progress        = progressAlongRoute(currentLocation, waypoints);
  const progressPercent = Math.min(100, Math.round(progress * 100));

  // ── 4. Remaining ETA (linear estimate) ─────────────────────────────────
  const remainingEtaMinutes = Math.max(
    0,
    Math.round(expectedEtaMinutes * (1 - progress)),
  );

  // ── 5. Destination reached ──────────────────────────────────────────────
  const distToDestinationM = haversineDistance(currentLocation, endLocation);
  const reachedThresholdM  = DESTINATION_THRESHOLD_M[mode] ?? 50;
  const destinationReached = distToDestinationM <= reachedThresholdM;

  // ── 6. isOnRoute (within the 'none' or 'minor' band) ───────────────────
  // Minor deviation is still considered "on route" for the boolean flag.
  // The deviationLevel gives the frontend more nuance if it needs it.
  const isOnRoute = deviationLevel === 'none' || deviationLevel === 'minor';

  // ── 7. Status + reason from deviation level ─────────────────────────────
  // Destination reached always overrides to GREEN regardless of deviation.
  const status = destinationReached
    ? 'GREEN'
    : deviationLevelToStatus(deviationLevel);

  const reason = destinationReached
    ? 'Destination reached'
    : deviationLevel === 'none' && progressPercent > 0
      ? `On route — ${progressPercent}% complete`
      : deviationLevelToReason(deviationLevel, distanceFromRouteMeters);

  return {
    tripId:                  session.tripId,
    timestamp:               timestamp.toISOString(),
    currentLocation,
    distanceFromRouteMeters,
    deviationLevel,           // ← Milestone 5 addition
    isOnRoute,
    progressPercent,
    remainingEtaMinutes,
    destinationReached,
    status,
    reason,
    // Milestone 6: rejoinedRoute requires previous-state context that only the
    // stateful route handler (updateLocation.ts) possesses. This function is
    // stateless, so it always returns false here. The route handler sets the
    // real value when it calls detectRecovery() and merges into the response.
    rejoinedRoute: false,
  };
}

/**
 * Convenience re-export so callers can check deviation without importing
 * the classifier directly.
 */
export { deviationRequiresCheckIn };

// ---------------------------------------------------------------------------
// Example outputs (walking mode, none=25 / minor=50 / warning=150):
//
//  distM=10  → deviationLevel:'none'     status:'GREEN'  reason:'On route — 18% complete'
//  distM=35  → deviationLevel:'minor'    status:'GREEN'  reason:'Slight deviation (35m) — still on track'
//  distM=90  → deviationLevel:'warning'  status:'YELLOW' reason:'Moderate deviation from route (90m)'
//  distM=200 → deviationLevel:'critical' status:'RED'    reason:'Route deviation of 200m detected'
//
// Example outputs (car mode, none=50 / minor=100 / warning=400):
//
//  distM=40  → deviationLevel:'none'     status:'GREEN'
//  distM=75  → deviationLevel:'minor'    status:'GREEN'
//  distM=250 → deviationLevel:'warning'  status:'YELLOW'
//  distM=500 → deviationLevel:'critical' status:'RED'
// ---------------------------------------------------------------------------
