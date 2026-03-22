import {
  Client,
  TravelMode,
  Status,
} from '@googlemaps/google-maps-services-js';
import { env } from '../config/env';
import { appConfig } from '../config/appConfig';
import {
  CommuteMode,
  LatLng,
  RouteOption,
  MapsError,
} from '../types/maps';
import { decodePolyline } from '../utils/geometry';
import { getMockRouteOptions } from '../mocks/mockRoutes';

// ---------------------------------------------------------------------------
// Google Maps client — one instance shared across all requests
// ---------------------------------------------------------------------------
const mapsClient = new Client({});

// Human-readable names assigned by position after sorting by duration.
// Index 0 = fastest, 1 = middle, 2 = longest.
const ROUTE_NAMES = ['Fastest Route', 'Recommended Route', 'Scenic Route'] as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Maps our CommuteMode to the Google Maps TravelMode enum.
 * Centralised here so the rest of the code never imports the Google SDK directly.
 */
function toGoogleTravelMode(mode: CommuteMode): TravelMode {
  return mode === 'car' ? TravelMode.driving : TravelMode.walking;
}

/**
 * Validates that a LatLng has values within real-world ranges.
 * Throws MapsError with code INVALID_COORDINATES if not.
 */
function validateLatLng(coords: LatLng, label: string): void {
  const { lat, lng } = coords;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new MapsError(
      'INVALID_COORDINATES',
      `${label} has invalid coordinates: { lat: ${lat}, lng: ${lng} }`,
    );
  }
}

// decodePolyline is now the single canonical implementation in utils/geometry.ts

// ---------------------------------------------------------------------------
// Step 1 — Geocoding: destination text → LatLng
// ---------------------------------------------------------------------------

/**
 * Converts a free-text destination string into lat/lng coordinates.
 * The result is used as the `destination` parameter for fetchRoutes().
 *
 * @throws MapsError(DESTINATION_NOT_FOUND) if Google returns zero results
 * @throws MapsError(API_FAILURE) on network errors or bad API status
 */
export async function geocodeDestination(address: string): Promise<LatLng> {
  try {
    const response = await mapsClient.geocode({
      params: {
        address,
        key: env.GOOGLE_MAPS_API_KEY,
      },
    });

    const geoStatus = response.data.status;
    if (geoStatus !== Status.OK || response.data.results.length === 0) {
      console.error(`[SafeWalk] Geocoding failed for "${address}" — status: ${geoStatus}`);
      throw new MapsError(
        'DESTINATION_NOT_FOUND',
        `Could not find location for: "${address}" (Google status: ${geoStatus})`,
      );
    }

    const { lat, lng } = response.data.results[0].geometry.location;
    return { lat, lng };

  } catch (err) {
    if (err instanceof MapsError) throw err;
    console.error('[SafeWalk] Geocoding request failed:', err);
    throw new MapsError('API_FAILURE', 'Geocoding request failed', err);
  }
}

// ---------------------------------------------------------------------------
// Step 2 — Directions: origin + destination + mode → RouteOption[]
// ---------------------------------------------------------------------------

/**
 * Fetches up to 3 route alternatives from Google Directions API and
 * returns them as normalised RouteOption objects sorted by duration.
 *
 * Raw Google objects (DirectionsRoute, DirectionsLeg, etc.) are
 * intentionally never returned — all data flows through RouteOption.
 *
 * @throws MapsError(NO_ROUTES_FOUND) if Google returns zero routes
 * @throws MapsError(API_FAILURE) on network/API errors
 */
export async function fetchRoutes(
  origin: LatLng,
  destination: LatLng,
  mode: CommuteMode,
): Promise<RouteOption[]> {
  validateLatLng(origin, 'origin');
  validateLatLng(destination, 'destination');

  try {
    const response = await mapsClient.directions({
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode: toGoogleTravelMode(mode),
        alternatives: true,   // request up to 3 route alternatives
        key: env.GOOGLE_MAPS_API_KEY,
      },
    });

    const { status, routes } = response.data;

    // Log the raw status so it appears in the backend terminal on any failure
    if (status !== Status.OK) {
      console.error(
        `[SafeWalk] Google Directions API returned status: ${status}`,
        `| origin: ${origin.lat},${origin.lng}`,
        `| destination: ${destination.lat},${destination.lng}`,
        `| mode: ${mode}`,
      );
    }

    if (status !== Status.OK || routes.length === 0) {
      throw new MapsError(
        'NO_ROUTES_FOUND',
        `No routes found (Google status: ${status})`,
      );
    }

    // Sort by total duration ascending (fastest first).
    // Use optional chaining (?.) on duration/distance because the Google SDK
    // types some leg fields as potentially null when traffic data is absent
    // or when the route segment is a non-driving/walking type.
    const sorted = [...routes].sort((a, b) => {
      const durA = a.legs.reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0);
      const durB = b.legs.reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0);
      return durA - durB;
    });

    // Take at most 3 and normalise each one
    return sorted.slice(0, 3).map((route, index) => {
      // A route can have multiple legs if there are waypoints.
      // For point-to-point trips there is always exactly one leg.
      const totalDurationSec = route.legs.reduce(
        (sum, leg) => sum + (leg.duration?.value ?? 0), 0,
      );
      const totalDistanceM = route.legs.reduce(
        (sum, leg) => sum + (leg.distance?.value ?? 0), 0,
      );

      const firstLeg = route.legs[0];
      const lastLeg  = route.legs[route.legs.length - 1];

      if (!firstLeg || !lastLeg) {
        throw new MapsError('NO_ROUTES_FOUND', `Route ${index} has no legs`);
      }

      const encodedPolyline = route.overview_polyline?.points ?? '';
      const waypoints = encodedPolyline ? decodePolyline(encodedPolyline) : [
        { lat: firstLeg.start_location.lat, lng: firstLeg.start_location.lng },
        { lat: lastLeg.end_location.lat,    lng: lastLeg.end_location.lng   },
      ];

      return {
        id:             `route_${index}`,
        name:           ROUTE_NAMES[index] ?? `Route ${index + 1}`,
        mode,
        etaMinutes:     Math.round(totalDurationSec / 60),
        distanceMeters: Math.round(totalDistanceM),
        polyline:       encodedPolyline,
        waypoints,
        startLocation: {
          lat: firstLeg.start_location.lat,
          lng: firstLeg.start_location.lng,
        },
        endLocation: {
          lat: lastLeg.end_location.lat,
          lng: lastLeg.end_location.lng,
        },
        // summary is the major street name Google provides — may be empty or null
        summary: route.summary || undefined,
      } satisfies RouteOption;
    });

  } catch (err) {
    if (err instanceof MapsError) throw err;
    // Log the raw error so it appears in the backend terminal
    console.error('[SafeWalk] Directions request failed:', err);
    throw new MapsError('API_FAILURE', 'Directions request failed', err);
  }
}

// ---------------------------------------------------------------------------
// Step 3 — Public façade: text + currentLocation + mode → RouteOption[]
// This is the only function routes/getRoutes.ts needs to call.
// ---------------------------------------------------------------------------

/**
 * Full pipeline with resilience — Milestone 8.
 *
 * Behaviour depends on appConfig:
 *
 *   USE_MOCK_MODE = true
 *     → Returns mock routes immediately. No API call is made.
 *       Safe to use with no API key, offline, or during a demo.
 *
 *   USE_MOCK_MODE = false, AUTO_FALLBACK_ON_ERROR = true  (default real mode)
 *     → Calls Google Maps. If ANY error occurs (network, quota, bad key,
 *       no routes found), logs a warning and returns mock routes instead.
 *       The frontend receives valid RouteOption[] either way.
 *
 *   USE_MOCK_MODE = false, AUTO_FALLBACK_ON_ERROR = false
 *     → Calls Google Maps and throws on failure (for integration tests).
 *
 * The frontend and all downstream milestones call this function — they never
 * need to know which mode is active.
 *
 * @param destinationText  Free-text address e.g. "Times Square, New York"
 * @param currentLocation  Device GPS coords at the moment the user starts planning
 * @param mode             'walking' | 'car'
 * @returns                2–3 sorted, normalised RouteOption objects
 */
export async function getRouteOptions(
  destinationText: string,
  currentLocation: LatLng,
  mode: CommuteMode,
): Promise<RouteOption[]> {
  // ── Mock mode: skip the API entirely ───────────────────────────────────
  if (appConfig.USE_MOCK_MODE) {
    return getMockRouteOptions(currentLocation, mode);
  }

  // ── Real mode: call Google Maps with optional auto-fallback ────────────
  console.log(
    `[SafeWalk] Fetching real routes | dest="${destinationText}" mode=${mode}`,
    `origin=${currentLocation.lat.toFixed(4)},${currentLocation.lng.toFixed(4)}`,
  );

  try {
    validateLatLng(currentLocation, 'currentLocation');
    const destinationCoords = await geocodeDestination(destinationText);
    console.log(
      `[SafeWalk] Geocoded "${destinationText}" →`,
      `${destinationCoords.lat.toFixed(4)},${destinationCoords.lng.toFixed(4)}`,
    );
    const routes = await fetchRoutes(currentLocation, destinationCoords, mode);
    console.log(`[SafeWalk] Got ${routes.length} real route(s) from Google`);
    return routes;

  } catch (err) {
    if (!appConfig.AUTO_FALLBACK_ON_ERROR) {
      throw err;
    }

    const message = err instanceof MapsError ? err.message : String(err);
    console.warn(`[SafeWalk] Maps API failed — falling back to mock routes. Reason: ${message}`);
    return getMockRouteOptions(currentLocation, mode);
  }
}
