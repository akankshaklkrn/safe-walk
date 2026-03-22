/**
 * completionService.ts — Milestone 7
 *
 * Two responsibilities:
 *   1. Decide whether the user has reached their destination.
 *   2. Build the TripSummary object returned to the frontend.
 *
 * Both are pure functions — they read data and return values, with no
 * side effects. The route handler (updateLocation.ts) owns the mutation
 * of trip state when completion is confirmed.
 */

import { haversineDistance } from '../utils/geometry';
import { DeviationLevel } from '../utils/deviationClassifier';
import { CommuteMode, LatLng } from '../types/maps';
import { Trip } from '../types/trip';
import { TripSummary } from '../types/tripSummary';

// ---------------------------------------------------------------------------
// Destination threshold — how close is "arrived"
// ---------------------------------------------------------------------------

/**
 * Maximum distance from the route's endpoint for the trip to be considered
 * complete.
 *
 * Walking is stricter because pedestrian navigation ends at a precise doorstep.
 * Driving is looser to account for parking, drop-off zones, and GPS drift
 * common in urban canyons.
 *
 * These values deliberately match the destination radius in tripUpdateService.ts
 * so both systems agree on what "arrived" means.
 */
export const DESTINATION_THRESHOLD_M: Record<CommuteMode, number> = {
  walking: 30,   // ~3–4 adult steps from the destination
  car:     80,   // ~parking spot + GPS drift buffer
};

// ---------------------------------------------------------------------------
// Destination check
// ---------------------------------------------------------------------------

/**
 * Returns true when the user is within the mode-appropriate arrival radius
 * of the route endpoint.
 *
 * Uses straight-line Haversine distance to the endpoint, not distance from
 * the polyline. At the end of a trip the user may be approaching from any
 * direction, so the polyline projection becomes unreliable.
 *
 * @param currentLocation  Live GPS coordinate from the device
 * @param endLocation      The route's final waypoint (from TripSession.endLocation)
 * @param mode             Commute mode — determines threshold radius
 */
export function isDestinationReached(
  currentLocation: LatLng,
  endLocation: LatLng,
  mode: CommuteMode,
): boolean {
  const distM = haversineDistance(currentLocation, endLocation);
  return distM <= (DESTINATION_THRESHOLD_M[mode] ?? 50);
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

/**
 * Assembles the TripSummary object from the trip's internal state.
 * Called exactly once per trip — when isDestinationReached() first returns true.
 *
 * @param trip                        Internal Trip object from tripStore
 * @param completedAt                 Timestamp of the completing location update
 * @param finalDistanceFromRouteMeters distanceFromRoute() result for this update
 * @param finalDeviationLevel         classifyDeviation() result for this update
 *
 * @returns TripSummary ready to send directly to the frontend
 *
 * Example output:
 * {
 *   tripId:                    "abc-123",
 *   completedAt:               "2026-03-21T15:42:10.000Z",
 *   actualDurationSeconds:     1170,
 *   actualDurationMinutes:     20,
 *   destinationReached:        true,
 *   finalDistanceFromRouteMeters: 8,
 *   finalDeviationLevel:       "none"
 * }
 */
export function buildTripSummary(
  trip: Trip,
  completedAt: Date,
  finalDistanceFromRouteMeters: number,
  finalDeviationLevel: DeviationLevel,
): TripSummary {
  const actualDurationSeconds = Math.round(
    (completedAt.getTime() - trip.startTime.getTime()) / 1000,
  );

  return {
    tripId:                      trip.tripId,
    completedAt:                 completedAt.toISOString(),
    actualDurationSeconds,
    actualDurationMinutes:       Math.round(actualDurationSeconds / 60),
    destinationReached:          true,
    finalDistanceFromRouteMeters,
    finalDeviationLevel,
  };
}
