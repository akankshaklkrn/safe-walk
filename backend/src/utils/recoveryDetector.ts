/**
 * recoveryDetector.ts — Milestone 6
 *
 * Pure, stateless function that determines whether a user has rejoined their
 * planned route after a deviation, using hysteresis to prevent noisy flipping.
 *
 * Why hysteresis?
 * ──────────────
 * GPS readings jitter. A user standing exactly on the edge of the 'minor'
 * threshold will oscillate between on-route and off-route every few seconds,
 * producing a constant stream of "rejoined!" signals and making the frontend
 * status indicator flicker.
 *
 * Solution: require REJOIN_CONFIRM_COUNT consecutive on-route readings before
 * declaring a rejoin. This gives a small confirmation window that filters out
 * single-sample noise while still responding quickly for a hackathon demo
 * (2 × 15 s poll interval = 30 s confirmation, feels instant in practice).
 *
 * The caller (updateLocation.ts) owns the mutable state (wasOffRoute,
 * consecutiveOnRouteCount). This function is pure — it returns the new state
 * values without mutating anything.
 */

import { DeviationLevel } from './deviationClassifier';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * How many consecutive on-route readings are required before declaring
 * that the user has successfully rejoined the route.
 *
 * 2 = ~30 s at the default 15 s poll interval.
 * Increase to 3–4 for production if GPS is noisier on target devices.
 */
export const REJOIN_CONFIRM_COUNT = 2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecoveryResult {
  /**
   * True exactly once — on the update where the consecutive on-route count
   * first reaches REJOIN_CONFIRM_COUNT after a period of deviation.
   *
   * It is false on every subsequent on-route update (not a persistent flag).
   * The frontend should show a "Back on track" toast when this flips to true.
   */
  rejoinedRoute: boolean;

  /** Updated consecutive count to store back onto the Trip. */
  newConsecutiveOnRouteCount: number;

  /**
   * Updated wasOffRoute flag to store back onto the Trip.
   * Cleared to false after rejoinedRoute fires so the signal doesn't repeat.
   */
  newWasOffRoute: boolean;
}

// ---------------------------------------------------------------------------
// Helper predicates
// ---------------------------------------------------------------------------

/**
 * Deviation levels that count as "on route".
 * 'minor' is intentionally included — a slight GPS drift while walking on
 * a narrow footpath should not count as "off route" for recovery purposes.
 */
function isOnRoute(level: DeviationLevel): boolean {
  return level === 'none' || level === 'minor';
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Determines whether the user has rejoined the route this update.
 *
 * @param currentLevel            DeviationLevel from classifyDeviation() this frame
 * @param consecutiveOnRouteCount Stored on Trip — how many consecutive on-route
 *                                readings have occurred in the current streak
 * @param wasOffRoute             Stored on Trip — true if the user was at
 *                                'warning' or 'critical' before this streak
 * @param confirmCount            Hysteresis window size (defaults to constant)
 *
 * @returns RecoveryResult with updated state to persist back to the Trip
 *
 * Example scenarios:
 *
 *   Noisy GPS — user never actually left:
 *     Update 1: critical → wasOffRoute=true, count=0
 *     Update 2: none     → count=1, rejoin=false (not confirmed yet)
 *     Update 3: warning  → count reset to 0 (was noise)
 *     → No rejoin signal fired. Correct.
 *
 *   Real deviation then recovery:
 *     Update 1: warning  → wasOffRoute=true, count=0
 *     Update 2: critical → wasOffRoute=true, count=0
 *     Update 3: none     → count=1, rejoin=false
 *     Update 4: minor    → count=2 → rejoinedRoute=true! wasOffRoute=false
 *     Update 5: none     → count=3, rejoin=false (signal already fired)
 *     → Single clean rejoin signal. Correct.
 *
 *   Trip starts on-route — no prior deviation:
 *     Update 1: none     → count=1, wasOffRoute=false → rejoin=false
 *     Update 2: none     → count=2, wasOffRoute=false → rejoin=false
 *     → No spurious rejoin at trip start. Correct.
 */
export function detectRecovery(
  currentLevel: DeviationLevel,
  consecutiveOnRouteCount: number,
  wasOffRoute: boolean,
  confirmCount: number = REJOIN_CONFIRM_COUNT,
): RecoveryResult {
  if (!isOnRoute(currentLevel)) {
    // ── Off-route: reset the streak and mark the user as deviated ──────────
    return {
      rejoinedRoute:               false,
      newConsecutiveOnRouteCount:  0,
      newWasOffRoute:              true,   // latch stays true until rejoin fires
    };
  }

  // ── On-route: extend the streak ────────────────────────────────────────
  const newCount = consecutiveOnRouteCount + 1;

  // Fire the rejoin signal exactly once: when the streak just hit the
  // confirmation threshold AND the user was previously off-route.
  const rejoinedRoute = newCount === confirmCount && wasOffRoute;

  return {
    rejoinedRoute,
    newConsecutiveOnRouteCount: newCount,
    // Clear wasOffRoute after the signal fires so it doesn't repeat.
    newWasOffRoute: rejoinedRoute ? false : wasOffRoute,
  };
}
