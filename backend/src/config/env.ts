import 'dotenv/config';

/**
 * Validated environment configuration.
 *
 * GOOGLE_MAPS_API_KEY is now optional — when absent, appConfig.USE_MOCK_MODE
 * is automatically set to true and the backend runs on mock route data.
 * This prevents a startup crash during the demo if the key isn't configured.
 *
 * Set SAFEWALK_MOCK_MODE=true explicitly to force mock mode even when a key
 * is present (e.g. to save API quota during development).
 */
export const env = {
  PORT: parseInt(process.env.PORT ?? '3000', 10),

  /**
   * Google Maps Platform API key.
   * Empty string when not configured — mapsService checks appConfig.USE_MOCK_MODE
   * before using this value, so an empty string is never sent to Google.
   */
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY ?? '',
  SMTP_HOST: process.env.SMTP_HOST ?? '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT ?? '587', 10),
  SMTP_USER: process.env.SMTP_USER ?? '',
  SMTP_PASS: process.env.SMTP_PASS ?? '',
  SMTP_FROM: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? '',
};

// Warn (don't crash) if the key is missing and mock mode hasn't been forced
if (!env.GOOGLE_MAPS_API_KEY && process.env.SAFEWALK_MOCK_MODE !== 'true') {
  console.warn(
    '[SafeWalk] GOOGLE_MAPS_API_KEY is not set. ' +
    'Running in auto-mock mode. Set the key in .env for real route data.',
  );
}
