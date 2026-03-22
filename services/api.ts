import * as Location from 'expo-location';
import type { CommuteMode, Route, SafetyStatus } from '../types';

// On a phone, localhost refers to the phone itself, not your PC.
// Set EXPO_PUBLIC_API_URL in your .env to your PC's LAN IP, e.g.:
//   EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
// Leave unset (or keep 'http://localhost:3000') for browser/web testing.
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Backend response shapes — mirrors backend/src/types/ without a compile dep
// ---------------------------------------------------------------------------

export type DeviationLevel = 'none' | 'minor' | 'warning' | 'critical';

export interface RouteOptionRaw {
  id: string;
  name: string;
  mode: CommuteMode;
  etaMinutes: number;
  distanceMeters: number;
  polyline: string;
  waypoints: Array<{ lat: number; lng: number }>;
  startLocation: { lat: number; lng: number };
  endLocation:   { lat: number; lng: number };
  summary?: string;
}

export interface TripSession {
  tripId: string;
  routeId: string;
  userId: string;
  mode: CommuteMode;
  destination: string;
  startedAt: string;
  status: 'GREEN' | 'YELLOW' | 'RED';
  expectedEtaMinutes: number;
  distanceMeters?: number;
  deviationThresholdMeters: { yellow: number; red: number };
  inactivityThresholdMs:    { yellow: number; red: number };
  checkInTimeoutMs: number;
  startLocation: { lat: number; lng: number };
  endLocation:   { lat: number; lng: number };
  trustedContact: { name: string; phone: string; email: string };
}

/** Summary returned by backend when destination is reached (Milestone 7) */
export interface TripSummaryRaw {
  tripId: string;
  completedAt: string;
  actualDurationSeconds: number;
  actualDurationMinutes: number;
  destinationReached: true;
  finalDistanceFromRouteMeters: number;
  finalDeviationLevel: DeviationLevel;
}

/** Full shape of POST /update-location response including M5-M7 fields */
export interface LocationUpdateResult {
  status: 'GREEN' | 'YELLOW' | 'RED';
  reason: string;
  checkInRequired: boolean;
  escalated: boolean;
  /** Four-level deviation classification (Milestone 5) */
  deviationLevel: DeviationLevel;
  /** True exactly once when user re-joins the route after deviation (Milestone 6) */
  rejoinedRoute: boolean;
  /** True once the destination radius is entered (Milestone 7) */
  tripCompleted: boolean;
  /** Non-null when tripCompleted is true */
  summary: TripSummaryRaw | null;
}

// ---------------------------------------------------------------------------
// Status mapping — backend GREEN/YELLOW/RED → frontend safe/uncertain/risk
// ---------------------------------------------------------------------------
export function mapBackendStatus(s: 'GREEN' | 'YELLOW' | 'RED'): SafetyStatus {
  if (s === 'YELLOW') return 'uncertain';
  if (s === 'RED')    return 'risk';
  return 'safe';
}

// Deviation level → emoji label for display
export function deviationLevelLabel(level: DeviationLevel): string {
  switch (level) {
    case 'none':     return '✅ On route';
    case 'minor':    return '🟡 Slight drift';
    case 'warning':  return '🟠 Off route';
    case 'critical': return '🔴 Far off route';
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
export function formatEta(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  return `${miles.toFixed(1)} mi`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} min` : `${m} min ${s}s`;
}

// Converts a raw backend RouteOption into the Route shape RouteCard expects
export function toDisplayRoute(raw: RouteOptionRaw): Route & { _raw: RouteOptionRaw } {
  return {
    id:          raw.id,
    name:        raw.name,
    eta:         formatEta(raw.etaMinutes),
    distance:    formatDistance(raw.distanceMeters),
    observation: raw.summary ?? `Via ${raw.name}`,
    _raw:        raw,
  };
}

// ---------------------------------------------------------------------------
// Device location — uses expo-location on native, navigator.geolocation on web
// ---------------------------------------------------------------------------
export async function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  const fallback = { lat: 40.7128, lng: -74.006 };

  try {
    // Request foreground location permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[SafeWalk] Location permission denied — using fallback coords');
      return fallback;
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (err) {
    console.warn('[SafeWalk] expo-location failed — using fallback coords', err);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/** Decodes a Google encoded polyline string into an array of lat/lng points. */
export function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0; let result = 0; let byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

export interface PlaceSuggestion {
  description: string;
  placeId: string;
}

/** Fetch place autocomplete suggestions for a partial address string */
export async function getPlaceSuggestions(input: string): Promise<PlaceSuggestion[]> {
  if (!input || input.length < 2) return [];
  const url = `${API_BASE}/places/autocomplete?input=${encodeURIComponent(input)}`;
  console.log('[SafeWalk] Autocomplete fetch →', url);
  try {
    const res = await fetch(url, { signal: timeoutSignal(8000) });
    if (!res.ok) {
      console.warn('[SafeWalk] Autocomplete non-OK status:', res.status);
      return [];
    }
    const data = await res.json() as { predictions: PlaceSuggestion[] };
    console.log('[SafeWalk] Autocomplete results:', data.predictions?.length ?? 0);
    return data.predictions ?? [];
  } catch (err) {
    console.warn('[SafeWalk] Autocomplete fetch failed:', err);
    return [];
  }
}

/** Creates an AbortSignal that times out after ms milliseconds (Hermes-compatible). */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/** Ping the backend health endpoint — returns true if reachable */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: timeoutSignal(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Fetch 2-3 route options from the backend (real or mock, transparent to caller) */
export async function fetchRoutes(
  destination: string,
  mode: CommuteMode,
  currentLocation: { lat: number; lng: number },
): Promise<Array<Route & { _raw: RouteOptionRaw }>> {
  const res = await fetch(`${API_BASE}/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destination, mode, currentLocation }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Failed to fetch routes');
  }
  const data = await res.json() as { routes: RouteOptionRaw[] };
  return data.routes.map(toDisplayRoute);
}

/** Create a trip session on the backend — returns TripSession */
export async function startTrip(params: {
  userId: string;
  destination: string;
  trustedContact: { name: string; phone: string; email: string };
  selectedRoute: RouteOptionRaw;
  currentLocation: { lat: number; lng: number };
}): Promise<TripSession> {
  const res = await fetch(`${API_BASE}/start-trip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Failed to start trip');
  }
  const data = await res.json() as { session: TripSession };
  return data.session;
}

/** Send a location update — returns full M5-M7 enriched result */
export async function updateLocation(
  tripId: string,
  lat: number,
  lng: number,
): Promise<LocationUpdateResult> {
  const res = await fetch(`${API_BASE}/update-location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tripId, lat, lng }),
  });
  if (!res.ok) throw new Error('Failed to update location');
  return res.json() as Promise<LocationUpdateResult>;
}

/** Submit a check-in response (ok / sos / danger-word / no-response) */
export async function submitCheckResponse(
  tripId: string,
  response: 'ok' | 'sos' | 'danger-word' | 'no-response',
): Promise<{ status: string; escalated: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/check-response`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tripId, response }),
  });
  if (!res.ok) throw new Error('Failed to submit check response');
  return res.json();
}

/** Fetch full trip status snapshot — useful for debugging */
export async function fetchTripStatus(tripId: string): Promise<{
  status: string;
  tripCompleted: boolean;
  summary: TripSummaryRaw | null;
  elapsedSeconds: number;
  alertLog: string[];
}> {
  const res = await fetch(`${API_BASE}/status/${tripId}`);
  if (!res.ok) throw new Error('Failed to fetch trip status');
  return res.json();
}
