/**
 * deviationClassifier.ts — Milestone 5
 *
 * Pure classification functions that convert a raw distance in metres
 * into a structured DeviationLevel.
 *
 * Design goals:
 *   - No side effects — input in, output out
 *   - No knowledge of trip state, inactivity, or SOS (that's riskEngine's job)
 *   - P3 AI layer can import DeviationLevel and respond to 'warning'/'critical'
 *     without needing to know the underlying metre values
 *   - Thresholds come from deviationConfig so they stay configurable
 */

import { DeviationThresholdConfig } from '../config/deviationConfig';

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

/**
 * Four ordered levels of route deviation, from safest to most serious.
 *
 *   none     → user is on route — no action
 *   minor    → slight stray — log only, status stays GREEN
 *   warning  → meaningful deviation — show check-in prompt, status YELLOW
 *   critical → large deviation — escalate immediately, status RED
 *
 * P3 integration note:
 *   The AI companion can read deviationLevel directly from TripUpdate
 *   to decide what to say:
 *     'none'     → keep chatting normally
 *     'minor'    → "You seem to have taken a small detour — no worries!"
 *     'warning'  → "Hey, are you still okay? You seem a bit off route."
 *     'critical' → trigger safety prompt / escalation flow
 */
export type DeviationLevel = 'none' | 'minor' | 'warning' | 'critical';

// ---------------------------------------------------------------------------
// Core classifier
// ---------------------------------------------------------------------------

/**
 * Classifies a deviation distance into one of four named levels.
 *
 * The boundary check is exclusive-upper (< not <=) so that a user
 * standing exactly on a threshold boundary gets the more serious level.
 * This is intentionally conservative for a safety app.
 *
 * @param distanceMeters  Output of distanceFromRoute() — metres from nearest segment
 * @param config          Mode-specific threshold configuration
 * @returns               The most severe applicable DeviationLevel
 *
 * Example outputs (walking config: none=25, minor=50, warning=150):
 *   classifyDeviation(10,  walkingConfig) → 'none'
 *   classifyDeviation(30,  walkingConfig) → 'minor'
 *   classifyDeviation(80,  walkingConfig) → 'warning'
 *   classifyDeviation(200, walkingConfig) → 'critical'
 *
 * Example outputs (car config: none=50, minor=100, warning=400):
 *   classifyDeviation(40,  carConfig) → 'none'
 *   classifyDeviation(70,  carConfig) → 'minor'
 *   classifyDeviation(200, carConfig) → 'warning'
 *   classifyDeviation(500, carConfig) → 'critical'
 */
export function classifyDeviation(
  distanceMeters: number,
  config: DeviationThresholdConfig,
): DeviationLevel {
  if (distanceMeters < config.none)    return 'none';
  if (distanceMeters < config.minor)   return 'minor';
  if (distanceMeters < config.warning) return 'warning';
  return 'critical';
}

// ---------------------------------------------------------------------------
// Derived helpers — used by tripUpdateService to keep logic in one place
// ---------------------------------------------------------------------------

/**
 * Maps a DeviationLevel to the GREEN/YELLOW/RED traffic-light system.
 *
 *   none, minor  → GREEN  (no alert — minor is logged but not surfaced)
 *   warning      → YELLOW (check-in prompt shown to user)
 *   critical     → RED    (immediate escalation)
 *
 * Hackathon rationale: 'minor' stays GREEN because showing a yellow
 * indicator every time someone steps slightly off-path would create
 * alert fatigue and erode trust in the system during the demo.
 */
export function deviationLevelToStatus(
  level: DeviationLevel,
): 'GREEN' | 'YELLOW' | 'RED' {
  switch (level) {
    case 'critical': return 'RED';
    case 'warning':  return 'YELLOW';
    default:         return 'GREEN';  // none | minor
  }
}

/**
 * Returns a concise, human-readable explanation for the given level.
 * Designed to be shown directly in the app UI and the API response.
 */
export function deviationLevelToReason(
  level: DeviationLevel,
  distanceMeters: number,
): string {
  switch (level) {
    case 'none':
      return 'On route';
    case 'minor':
      return `Slight deviation (${distanceMeters}m) — still on track`;
    case 'warning':
      return `Moderate deviation from route (${distanceMeters}m)`;
    case 'critical':
      return `Route deviation of ${distanceMeters}m detected`;
  }
}

/**
 * Returns true if the deviation level requires a check-in prompt.
 * 'warning' and 'critical' both need user acknowledgement.
 */
export function deviationRequiresCheckIn(level: DeviationLevel): boolean {
  return level === 'warning' || level === 'critical';
}
