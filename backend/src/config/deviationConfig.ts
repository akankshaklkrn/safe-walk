import { CommuteMode } from '../types/maps';

/**
 * deviationConfig.ts — Milestone 5
 *
 * Configurable deviation thresholds for each commute mode.
 *
 * Why 4 levels instead of 2 (just YELLOW/RED)?
 * --------------------------------------------------
 * The existing RISK constants give us a binary "bad / worse" split.
 * Four levels let the frontend and P3 AI layer respond more gradually:
 *
 *   none     → user is solidly on route, no action needed
 *   minor    → slight stray (side street, shop) — still GREEN, log only
 *   warning  → meaningful deviation — show check-in prompt (YELLOW)
 *   critical → large deviation — escalate immediately (RED)
 *
 * The thresholds deliberately align with the existing RISK constants so
 * the two systems stay in sync:
 *
 *   minor threshold  = RISK[mode].DEVIATION_YELLOW_M   (same value)
 *   warning boundary = RISK[mode].DEVIATION_RED_M      (same value)
 *
 * This means changing RISK constants automatically shifts deviation levels.
 * For hackathon purposes the values are hardcoded here for clarity;
 * in production they would be fetched from a config service.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Distances in metres that define the upper boundary of each level.
 * Deviation is classified as the first level whose threshold the distance
 * does NOT exceed:
 *
 *   distM < none     → 'none'
 *   distM < minor    → 'minor'
 *   distM < warning  → 'warning'
 *   distM >= warning → 'critical'
 */
export interface DeviationThresholdConfig {
  /** Max metres to still be classified as 'none' (solidly on route) */
  none: number;
  /** Max metres to still be classified as 'minor' (slight stray, GREEN) */
  minor: number;
  /** Max metres to still be classified as 'warning' (check-in, YELLOW) */
  warning: number;
  // Above 'warning' → 'critical' (escalate, RED) — no upper bound
}

// ---------------------------------------------------------------------------
// Default configs
// ---------------------------------------------------------------------------

/**
 * Walking is stricter because:
 * - Pedestrian routes are narrow and precise
 * - A 50m deviation in a city is a full side street
 * - Safety concern appears faster on foot (no vehicle protection)
 *
 * Car is looser because:
 * - GPS in vehicles can drift 20–40m without actual deviation
 * - Traffic may force temporary detours (one-way streets, road works)
 * - A 100m deviation might just be an adjacent lane or parking manoeuvre
 */
export const DEFAULT_DEVIATION_CONFIG: Record<CommuteMode, DeviationThresholdConfig> = {
  walking: {
    none:    40,   // within a few steps of the route centreline
    minor:   120,  // up to ~1 city block — still GREEN, badge shows 'minor'
    warning: 300,  // clearly off route — show check-in prompt
    // > 300m → critical — matches RISK.walking.DEVIATION_RED_M
  },
  car: {
    none:    50,   // GPS drift + lane width tolerance
    minor:   100,  // minor traffic detour — still GREEN
    warning: 400,  // significant deviation — check-in prompt
    // > 400m → critical — matches RISK.car.DEVIATION_RED_M
  },
};

/**
 * Helper to get the deviation config for a given mode.
 * Falls back to walking config for unknown modes.
 */
export function getDeviationConfig(mode: CommuteMode): DeviationThresholdConfig {
  return DEFAULT_DEVIATION_CONFIG[mode] ?? DEFAULT_DEVIATION_CONFIG.walking;
}
