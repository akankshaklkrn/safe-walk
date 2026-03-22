import { Router, Request, Response } from 'express';
import { getRouteOptions } from '../services/mapsService';
import { MapsError } from '../types/maps';
import type { CommuteMode } from '../types/maps';

const router = Router();

/**
 * POST /routes
 *
 * Request body:
 * {
 *   destination:      string     // free-text address e.g. "Times Square, New York"
 *   mode:             "walking" | "car"
 *   currentLocation:  { lat: number; lng: number }
 * }
 *
 * Success response (200):
 * {
 *   routes: RouteOption[]
 * }
 *
 * Error responses:
 *   400 — missing/invalid input
 *   404 — destination not found or no routes available
 *   502 — Google Maps API failure
 */
router.post('/', async (req: Request, res: Response) => {
  const { destination, mode, currentLocation } = req.body;

  // ── Input validation ───────────────────────────────────────────────────
  if (!destination || typeof destination !== 'string') {
    return res.status(400).json({ error: 'destination (string) is required' });
  }

  if (mode !== 'walking' && mode !== 'car') {
    return res.status(400).json({ error: 'mode must be "walking" or "car"' });
  }

  if (
    !currentLocation ||
    typeof currentLocation.lat !== 'number' ||
    typeof currentLocation.lng !== 'number'
  ) {
    return res.status(400).json({
      error: 'currentLocation must be an object with numeric lat and lng fields',
    });
  }

  // ── Service call ────────────────────────────────────────────────────────
  try {
    const routes = await getRouteOptions(
      destination,
      currentLocation,
      mode as CommuteMode,
    );

    return res.json({ routes });

  } catch (err) {
    if (err instanceof MapsError) {
      // Map our typed error codes to HTTP status codes
      const statusMap: Record<string, number> = {
        DESTINATION_NOT_FOUND: 404,
        NO_ROUTES_FOUND:       404,
        INVALID_COORDINATES:   400,
        API_FAILURE:           502,
      };

      const status = statusMap[err.code] ?? 500;
      return res.status(status).json({ error: err.message, code: err.code });
    }

    // Unexpected error — don't leak internals
    console.error('Unexpected error in /routes:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
