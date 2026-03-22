import { LatLng } from './maps';
import { DeviationLevel } from '../utils/deviationClassifier';

// Re-export so callers only need to import from this file
export type { DeviationLevel };

/**
 * TripUpdate — Milestones 4 + 5
 *
 * Normalized output of a single live location update.
 * This is what every POST /update-location response is built from.
 *
 * All fields are safe to serialize to JSON and return to the frontend.
 * No raw Google Maps types or internal risk state leaks out here.
 */
export interface TripUpdate {
  tripId: string;

  /** ISO 8601 timestamp of when this update was calculated */
  timestamp: string;

  /** The device location that was submitted */
  currentLocation: LatLng;

  // ── Route adherence ───────────────────────────────────────────────────

  /** Perpendicular distance from the nearest route segment, in metres */
  distanceFromRouteMeters: number;

  /**
   * True if the user is within the YELLOW deviation threshold for their mode.
   * Walking: < 50m  |  Driving: < 100m
   */
  isOnRoute: boolean;

  // ── Progress ──────────────────────────────────────────────────────────

  /** How far along the route the user is, 0–100 (rounded integer) */
  progressPercent: number;

  /**
   * Estimated minutes remaining to the destination.
   * Calculated as: expectedEtaMinutes × (1 − progress)
   * This is a simple linear approximation — good enough for hackathon.
   */
  remainingEtaMinutes: number;

  /** True when the user is within the destination-reached threshold */
  destinationReached: boolean;

  // ── Risk assessment ───────────────────────────────────────────────────

  /**
   * Four-level deviation classification (Milestone 5).
   * More granular than status — P3 AI layer reads this directly.
   *
   *   none     → solidly on route
   *   minor    → slight stray, still GREEN
   *   warning  → meaningful deviation, YELLOW — check-in prompt shown
   *   critical → large deviation, RED — immediate escalation
   */
  deviationLevel: DeviationLevel;

  /**
   * Traffic-light status derived from deviationLevel.
   * Simpler for the frontend status indicator.
   */
  status: 'GREEN' | 'YELLOW' | 'RED';

  /** Human-readable explanation of the current status */
  reason: string;

  /**
   * True exactly once — on the update where the user's consecutive on-route
   * count reaches the confirmation threshold after a period of deviation.
   * (Milestone 6 — always false when computed by stateless updateTripLocation;
   * set to the real value by the route handler which owns trip state.)
   */
  rejoinedRoute: boolean;
}
