import 'dotenv/config';

/**
 * appConfig.ts — Milestone 8
 *
 * Central runtime configuration for SafeWalk backend.
 *
 * ── Mock mode ──────────────────────────────────────────────────────────────
 *
 * Mock mode makes every Google Maps API call return static, realistic-looking
 * route data instead of hitting the real API. This means:
 *
 *   - The backend works without a Google Maps API key
 *   - Demo judges can run the full app offline or on spotty wifi
 *   - Frontend consumers receive identical response shapes — no code changes
 *
 * Mock mode is ON when any of these conditions is true:
 *   1. SAFEWALK_MOCK_MODE=true  is set in the environment
 *   2. GOOGLE_MAPS_API_KEY      is missing (auto-fallback so we never crash)
 *
 * To use real Google Maps:
 *   GOOGLE_MAPS_API_KEY=<your key>
 *   SAFEWALK_MOCK_MODE=false    (or just omit the variable)
 *
 * ── Auto-fallback ─────────────────────────────────────────────────────────
 *
 * Even in real mode, if a live API call fails (network error, quota exceeded,
 * invalid API key during the demo), mapsService will automatically fall back
 * to mock data for that request only and log a warning.
 * Set SAFEWALK_DISABLE_FALLBACK=true to suppress this and surface errors
 * directly (useful for integration testing).
 */
const hasApiKey = Boolean(process.env.GOOGLE_MAPS_API_KEY);
const forceMock = process.env.SAFEWALK_MOCK_MODE === 'true';

export const appConfig = {
  /**
   * When true, all route fetches return static mock data.
   * Automatically true when no API key is configured.
   */
  USE_MOCK_MODE: forceMock || !hasApiKey,

  /**
   * When true, a failed real-API call falls back to mock data silently.
   * Set SAFEWALK_DISABLE_FALLBACK=true to disable and surface errors.
   * Has no effect in USE_MOCK_MODE (mock is always used there).
   */
  AUTO_FALLBACK_ON_ERROR: process.env.SAFEWALK_DISABLE_FALLBACK !== 'true',
} as const;

// Log mode at startup so it's immediately visible in the terminal
const modeLabel = appConfig.USE_MOCK_MODE ? '🟡 MOCK' : '🟢 REAL';
console.log(
  `[SafeWalk] Maps mode: ${modeLabel}${
    !appConfig.USE_MOCK_MODE && appConfig.AUTO_FALLBACK_ON_ERROR
      ? ' (auto-fallback enabled)'
      : ''
  }`,
);
