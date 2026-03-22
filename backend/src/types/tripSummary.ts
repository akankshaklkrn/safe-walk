import { DeviationLevel } from '../utils/deviationClassifier';

/**
 * TripSummary — Milestone 7
 *
 * Returned once when a trip completes (destination reached).
 * This is the object the frontend trip-complete screen consumes directly.
 *
 * Design rules:
 *   - All fields are serialisation-safe (no Date objects, no internal risk state).
 *   - No Google Maps types. No internal flags.
 *   - Fields are named for the frontend, not the database.
 */
export interface TripSummary {
  /** Matches the tripId the frontend has been tracking all along */
  tripId: string;

  /** ISO 8601 — when the destination radius was first entered */
  completedAt: string;

  /**
   * How long the trip actually took, in whole seconds.
   * Use for precise display ("42 minutes 10 seconds").
   */
  actualDurationSeconds: number;

  /**
   * Rounded whole minutes — the headline number on the completion screen.
   * e.g. "Trip completed in 18 minutes"
   */
  actualDurationMinutes: number;

  /**
   * Always true when this summary is produced — the summary is only ever
   * built on the destination-reached code path.
   * Included so the frontend can safely assert without extra checks.
   */
  destinationReached: true;

  /**
   * Distance from the route polyline at the moment the trip completed.
   * Gives context: did the user arrive cleanly or via a detour?
   */
  finalDistanceFromRouteMeters: number;

  /**
   * Deviation classification at trip completion.
   * Usually 'none' or 'minor' for a clean arrival; 'warning' means the
   * user cut through a park or a side street to reach the destination.
   */
  finalDeviationLevel: DeviationLevel;
}
