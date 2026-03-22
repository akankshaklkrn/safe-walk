/**
 * mockRoutes.ts — Milestone 8
 *
 * Generates realistic-looking RouteOption arrays without hitting Google Maps.
 *
 * ── Why location-relative routes? ─────────────────────────────────────────
 * Hardcoded NYC coordinates look wrong if the demo runs in a different city.
 * Instead, routes are generated as small lat/lng offsets from the user's
 * actual current location, so:
 *   - The route always starts where the user is
 *   - The map renders the route near the user's real position
 *   - The destination-reached logic works (user just walks a short distance)
 *   - No hardcoded city dependency
 *
 * ── Route shapes ─────────────────────────────────────────────────────────
 * Each route is a series of intermediate waypoints between origin and
 * a generated destination. The three route options differ in:
 *   - Distance (Fastest < Recommended < Scenic)
 *   - Path (direct / gentle arc / wider arc)
 *   - ETA
 *
 * ── polyline field ────────────────────────────────────────────────────────
 * The `polyline` field contains the Google-encoded string for the route.
 * Mock routes use an empty string — the frontend map component uses the
 * decoded `waypoints` array directly for rendering, so this is fine.
 */

import { CommuteMode, LatLng, RouteOption } from '../types/maps';

// ---------------------------------------------------------------------------
// Offsets — how far the mock destination is from the user's position
// ---------------------------------------------------------------------------

/**
 * Approximate lat/lng degrees per metre at mid-latitudes:
 *   1° lat ≈ 111,000 m
 *   1° lng ≈ 85,000 m  (at ~40° latitude)
 * These are used to convert a target distance into coordinate offsets.
 */
const M_PER_DEG_LAT = 111_000;
const M_PER_DEG_LNG =  85_000;

interface RouteTemplate {
  name:           string;
  distanceMeters: number;
  etaMinutes:     number;
  /** lat offset as a fraction of total distance (0–1) */
  latFraction:    number;
  /** lng offset as a fraction of total distance */
  lngFraction:    number;
  /** How much to bow the route sideways (0 = straight line) */
  bendFactor:     number;
  /** How many waypoints to interpolate */
  steps:          number;
}

const WALKING_TEMPLATES: RouteTemplate[] = [
  { name: 'Fastest Route',     distanceMeters: 650,  etaMinutes: 8,  latFraction: 0.7, lngFraction: 0.3, bendFactor: 0.0003, steps: 6  },
  { name: 'Recommended Route', distanceMeters: 850,  etaMinutes: 11, latFraction: 0.6, lngFraction: 0.4, bendFactor: 0.0006, steps: 8  },
  { name: 'Scenic Route',      distanceMeters: 1100, etaMinutes: 15, latFraction: 0.5, lngFraction: 0.5, bendFactor: 0.0010, steps: 10 },
];

const CAR_TEMPLATES: RouteTemplate[] = [
  { name: 'Fastest Route',     distanceMeters: 1800, etaMinutes: 6,  latFraction: 0.8, lngFraction: 0.2, bendFactor: 0.0008, steps: 8  },
  { name: 'Recommended Route', distanceMeters: 2300, etaMinutes: 9,  latFraction: 0.7, lngFraction: 0.3, bendFactor: 0.0012, steps: 10 },
  { name: 'Scenic Route',      distanceMeters: 3100, etaMinutes: 13, latFraction: 0.6, lngFraction: 0.4, bendFactor: 0.0018, steps: 12 },
];

// ---------------------------------------------------------------------------
// Waypoint generator
// ---------------------------------------------------------------------------

/**
 * Generates an array of LatLng waypoints between origin and destination.
 * The path is a gentle arc shaped by bendFactor, making it look like a
 * real road route rather than a straight line.
 *
 * @param origin      Starting point (user's current GPS)
 * @param destination End point (calculated from template offsets)
 * @param steps       Number of intermediate points
 * @param bendFactor  How much to bow the path sideways (degrees)
 */
function generateWaypoints(
  origin:      LatLng,
  destination: LatLng,
  steps:       number,
  bendFactor:  number,
): LatLng[] {
  const waypoints: LatLng[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;

    // Linear interpolation between origin and destination
    const lat = origin.lat + (destination.lat - origin.lat) * t;
    const lng = origin.lng + (destination.lng - origin.lng) * t;

    // Add a sinusoidal bend to simulate a real road arc
    // sin(t * π) peaks at the midpoint and returns to 0 at both ends
    const bend = bendFactor * Math.sin(t * Math.PI);

    waypoints.push({ lat: lat + bend, lng: lng + bend });
  }

  return waypoints;
}

// ---------------------------------------------------------------------------
// Public function
// ---------------------------------------------------------------------------

/**
 * Returns 3 mock RouteOption objects relative to the user's current location.
 *
 * Output shape is identical to the real mapsService output — the route handler
 * and all downstream milestones work without any changes.
 *
 * @param currentLocation  User's GPS position (used as route start)
 * @param mode             'walking' | 'car' — selects appropriate templates
 */
export function getMockRouteOptions(
  currentLocation: LatLng,
  mode: CommuteMode,
): RouteOption[] {
  const templates = mode === 'car' ? CAR_TEMPLATES : WALKING_TEMPLATES;

  return templates.map((tpl, index) => {
    // Convert distance × directional fractions into lat/lng degree offsets
    const latOffset = (tpl.distanceMeters * tpl.latFraction) / M_PER_DEG_LAT;
    const lngOffset = (tpl.distanceMeters * tpl.lngFraction) / M_PER_DEG_LNG;

    const endLocation: LatLng = {
      lat: currentLocation.lat + latOffset,
      lng: currentLocation.lng + lngOffset,
    };

    const waypoints = generateWaypoints(
      currentLocation,
      endLocation,
      tpl.steps,
      tpl.bendFactor,
    );

    return {
      id:             `mock_route_${index}`,
      name:           tpl.name,
      mode,
      etaMinutes:     tpl.etaMinutes,
      distanceMeters: tpl.distanceMeters,
      polyline:       '',          // empty — frontend uses waypoints[] for map rendering
      waypoints,
      startLocation:  currentLocation,
      endLocation,
      summary:        `Mock ${tpl.name} (demo)`,
      metrics: {
        stepCount: tpl.steps,
        directness: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
        turnCount: Math.max(1, Math.round(tpl.steps / 3)),
        intersectionCount: Math.max(1, tpl.steps - 1),
        activityLevel: index === 1 ? 'high' : index === 0 ? 'medium' : 'low',
        mainRoadExposure: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
        mainRoadRatio: index === 0 ? 0.65 : index === 1 ? 0.45 : 0.2,
        nearbyPlaceCount: index === 1 ? 5 : index === 0 ? 3 : 1,
        areaCharacter: index === 1 ? 'commercial' : index === 0 ? 'mixed' : 'residential',
      },
    } satisfies RouteOption;
  });
}
