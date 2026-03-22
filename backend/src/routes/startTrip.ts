import { Router, Request, Response } from 'express';
import { tripStore } from '../store/tripStore';
import { buildTrip } from '../services/tripService';
import { StartTripParams } from '../types/session';
import type { RouteOption } from '../types/maps';

const router = Router();

/**
 * POST /start-trip
 *
 * Called when the user taps "Start Trip" after selecting a route.
 * Expects the full RouteOption from the /routes response so we never
 * fall back to hardcoded data.
 *
 * Request body:
 * {
 *   userId:           string
 *   destination:      string          // the text the user typed
 *   trustedContact:   { name, phone, email? }
 *   selectedRoute:    RouteOption     // the full object from POST /routes
 *   currentLocation:  { lat, lng }    // device GPS at tap time
 * }
 *
 * Success response (201):
 * {
 *   session: TripSession
 * }
 */
router.post('/', (req: Request, res: Response) => {
  const { userId, destination, trustedContact, selectedRoute, currentLocation } = req.body;

  // ── Input validation ───────────────────────────────────────────────────
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId (string) is required' });
  }
  if (!destination || typeof destination !== 'string') {
    return res.status(400).json({ error: 'destination (string) is required' });
  }
  if (!trustedContact?.phone) {
    return res.status(400).json({ error: 'trustedContact.phone is required' });
  }
  if (!trustedContact?.email || typeof trustedContact.email !== 'string') {
    return res.status(400).json({ error: 'trustedContact.email is required' });
  }
  if (!isValidRouteOption(selectedRoute)) {
    return res.status(400).json({
      error: 'selectedRoute must be a valid RouteOption from POST /routes',
    });
  }
  if (
    !currentLocation ||
    typeof currentLocation.lat !== 'number' ||
    typeof currentLocation.lng !== 'number'
  ) {
    return res.status(400).json({
      error: 'currentLocation must have numeric lat and lng fields',
    });
  }

  // ── Build session + internal trip ──────────────────────────────────────
  const params: StartTripParams = {
    userId,
    destination,
    trustedContact,
    selectedRoute,
    currentLocation,
  };

  const { session, trip } = buildTrip(params);

  tripStore.set(session.tripId, trip);

  return res.status(201).json({ session });
});

// ── Guard — ensures the frontend sent a real RouteOption, not a partial ──

function isValidRouteOption(r: unknown): r is RouteOption {
  if (!r || typeof r !== 'object') return false;
  const route = r as Record<string, unknown>;
  return (
    typeof route.id === 'string' &&
    typeof route.name === 'string' &&
    (route.mode === 'walking' || route.mode === 'car') &&
    typeof route.etaMinutes === 'number' &&
    typeof route.distanceMeters === 'number' &&
    typeof route.polyline === 'string' &&
    Array.isArray(route.waypoints) &&
    typeof route.startLocation === 'object' &&
    typeof route.endLocation === 'object'
  );
}

export default router;
