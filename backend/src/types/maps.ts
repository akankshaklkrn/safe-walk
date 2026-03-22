// ---------------------------------------------------------------------------
// Maps domain types
// These are the shapes P2 owns and the frontend consumes.
// Raw Google Maps API objects never leave the service layer.
// ---------------------------------------------------------------------------

/** Matches the frontend's CommuteMode exactly so params pass through unchanged. */
export type CommuteMode = 'walking' | 'car';

/** A plain lat/lng coordinate pair used everywhere in the app. */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteMetrics {
  stepCount: number;
  directness: 'high' | 'medium' | 'low';
  turnCount: number;
  intersectionCount: number;
  activityLevel: 'high' | 'medium' | 'low';
  mainRoadExposure: 'high' | 'medium' | 'low';
  mainRoadRatio: number;
  nearbyPlaceCount: number;
  areaCharacter: 'commercial' | 'mixed' | 'residential';
}

/**
 * A single normalised route option returned to the frontend.
 * All numeric values are in SI units (metres, minutes) so the frontend
 * can format them however it likes (mi, km, "12 min", etc.).
 */
export interface RouteOption {
  id: string;                 // "route_0", "route_1", "route_2"
  name: string;               // "Fastest Route" | "Recommended Route" | "Scenic Route"
  mode: CommuteMode;
  etaMinutes: number;         // rounded integer
  distanceMeters: number;     // rounded integer
  polyline: string;           // Google encoded polyline — pass directly to Maps SDK
  waypoints: LatLng[];        // decoded polyline points for frontend map rendering
  startLocation: LatLng;
  endLocation: LatLng;
  summary?: string;           // major road names e.g. "Broadway and W 42nd St"
  metrics?: RouteMetrics;
}

// ---------------------------------------------------------------------------
// Error types — callers catch MapsError and read the code to decide response
// ---------------------------------------------------------------------------

export type MapsErrorCode =
  | 'DESTINATION_NOT_FOUND'   // geocoder returned zero results
  | 'NO_ROUTES_FOUND'         // Directions API returned zero routes
  | 'ROUTE_TOO_LONG'          // destination too far for the selected mode (walking limit ~5 km)
  | 'INVALID_COORDINATES'     // lat/lng out of valid range
  | 'API_FAILURE';            // network error or Google returned an error status

export class MapsError extends Error {
  constructor(
    public readonly code: MapsErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MapsError';
  }
}
