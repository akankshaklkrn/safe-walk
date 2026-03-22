/**
 * geometry.ts — Milestone 3
 *
 * Pure, stateless geometry utilities for route analysis.
 * All functions work on LatLng coordinates and return distances in metres.
 *
 * Assumptions (all safe for city-scale SafeWalk trips):
 * - The Earth is locally flat for segment projection math.
 *   Haversine is still used for final distance measurements.
 * - Routes stay within a single city, so coordinate deltas are tiny
 *   and treating (lat, lng) as a 2D Cartesian plane is accurate enough.
 */

import { LatLng } from '../types/maps';

const EARTH_RADIUS_M = 6_371_000;

// ---------------------------------------------------------------------------
// 1. Haversine distance — accurate great-circle distance in metres
// ---------------------------------------------------------------------------

/**
 * Returns the straight-line distance between two points in metres.
 * Uses the haversine formula — accurate at any scale.
 */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// ---------------------------------------------------------------------------
// 2. Polyline decoder — Google encoded polyline → LatLng[]
// ---------------------------------------------------------------------------

/**
 * Decodes a Google encoded polyline string into an ordered array of LatLng points.
 * Algorithm: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 *
 * Single source of truth — both mapsService and tripUpdateService import from here.
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    // Decode latitude delta
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;

    // Decode longitude delta
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

// ---------------------------------------------------------------------------
// 3. Nearest point on a segment
// ---------------------------------------------------------------------------

export interface NearestPointResult {
  nearestPoint: LatLng;
  distanceMeters: number;
  /** Interpolation parameter along the segment: 0 = segStart, 1 = segEnd */
  t: number;
}

/**
 * Finds the closest point on the line segment [segStart, segEnd] to `point`.
 *
 * Uses a flat-earth dot-product projection in (lat, lng) space.
 * Valid and accurate for city-scale distances (< ~50 km segments).
 *
 * Returns the nearest point, its distance from `point`, and the
 * interpolation parameter t ∈ [0, 1] along the segment.
 */
export function nearestPointOnSegment(
  point: LatLng,
  segStart: LatLng,
  segEnd: LatLng,
): NearestPointResult {
  const abLat = segEnd.lat - segStart.lat;
  const abLng = segEnd.lng - segStart.lng;
  const lenSq = abLat * abLat + abLng * abLng;

  // Degenerate segment (both endpoints identical) — return the point itself
  if (lenSq === 0) {
    return {
      nearestPoint: segStart,
      distanceMeters: haversineDistance(point, segStart),
      t: 0,
    };
  }

  // Project point onto the infinite line through A and B, clamp to [0, 1]
  const apLat = point.lat - segStart.lat;
  const apLng = point.lng - segStart.lng;
  const t = Math.max(0, Math.min(1, (apLat * abLat + apLng * abLng) / lenSq));

  const nearestPoint: LatLng = {
    lat: segStart.lat + t * abLat,
    lng: segStart.lng + t * abLng,
  };

  return {
    nearestPoint,
    distanceMeters: haversineDistance(point, nearestPoint),
    t,
  };
}

// ---------------------------------------------------------------------------
// 4. Nearest segment on a full route
// ---------------------------------------------------------------------------

export interface NearestSegmentResult {
  /** Index into `waypoints` of the segment start point */
  segmentIndex: number;
  nearestPoint: LatLng;
  distanceMeters: number;
  /** Interpolation parameter along that segment */
  t: number;
}

/**
 * Searches all segments of `waypoints` and returns the one closest to `point`.
 *
 * This is more accurate than comparing against discrete waypoints alone because
 * it correctly handles points that lie between two waypoints on a straight segment.
 *
 * Time complexity: O(n) where n = number of waypoints.
 */
export function nearestSegment(
  point: LatLng,
  waypoints: LatLng[],
): NearestSegmentResult {
  if (waypoints.length < 2) {
    // Edge case: single waypoint — return it as-is
    const wp = waypoints[0] ?? { lat: 0, lng: 0 };
    return {
      segmentIndex: 0,
      nearestPoint: wp,
      distanceMeters: haversineDistance(point, wp),
      t: 0,
    };
  }

  let best: NearestSegmentResult = {
    segmentIndex: 0,
    nearestPoint: waypoints[0],
    distanceMeters: Infinity,
    t: 0,
  };

  for (let i = 0; i < waypoints.length - 1; i++) {
    const result = nearestPointOnSegment(point, waypoints[i], waypoints[i + 1]);
    if (result.distanceMeters < best.distanceMeters) {
      best = { segmentIndex: i, ...result };
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// 5. Distance from route (segment-based — more accurate than waypoint-only)
// ---------------------------------------------------------------------------

/**
 * Returns how far `point` is from the nearest segment of the route, in metres.
 *
 * Improvement over the simple waypoint-distance approach:
 * a user walking exactly between two waypoints along the route will correctly
 * return ~0m deviation instead of the distance to the nearest waypoint.
 */
export function distanceFromRoute(point: LatLng, waypoints: LatLng[]): number {
  if (waypoints.length === 0) return Infinity;
  if (waypoints.length === 1) return haversineDistance(point, waypoints[0]);
  return nearestSegment(point, waypoints).distanceMeters;
}

// ---------------------------------------------------------------------------
// 6. Total route length
// ---------------------------------------------------------------------------

/**
 * Sums the haversine distances between consecutive waypoints.
 * Returns total route length in metres.
 */
export function totalRouteLength(waypoints: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += haversineDistance(waypoints[i], waypoints[i + 1]);
  }
  return total;
}

// ---------------------------------------------------------------------------
// 7. Progress along route (0 → 1)
// ---------------------------------------------------------------------------

/**
 * Estimates how far along the route the user has progressed as a ratio [0, 1].
 *
 * Algorithm:
 *   1. Find the nearest segment.
 *   2. Sum the full lengths of all segments before it.
 *   3. Add the partial length along the current segment (t × segmentLength).
 *   4. Divide by total route length.
 *
 * Returns 0 if the route has fewer than 2 waypoints.
 */
export function progressAlongRoute(point: LatLng, waypoints: LatLng[]): number {
  if (waypoints.length < 2) return 0;

  const total = totalRouteLength(waypoints);
  if (total === 0) return 0;

  const { segmentIndex, t } = nearestSegment(point, waypoints);

  // Length of all fully-completed segments
  let completed = 0;
  for (let i = 0; i < segmentIndex; i++) {
    completed += haversineDistance(waypoints[i], waypoints[i + 1]);
  }

  // Partial length along the current segment
  const currentSegLen = haversineDistance(
    waypoints[segmentIndex],
    waypoints[segmentIndex + 1],
  );
  completed += t * currentSegLen;

  return Math.min(1, completed / total);
}

// ---------------------------------------------------------------------------
// Example usage (not exported — for documentation only):
//
//   import { distanceFromRoute, progressAlongRoute, haversineDistance } from './geometry';
//
//   const waypoints = decodePolyline(session.routePolyline);
//   const currentLocation = { lat: 40.7135, lng: -74.0080 };
//
//   const distM    = distanceFromRoute(currentLocation, waypoints);
//   // → 43.2  (user is 43m from the route)
//
//   const progress = progressAlongRoute(currentLocation, waypoints);
//   // → 0.18  (user is 18% of the way to the destination)
//
//   const distToEnd = haversineDistance(currentLocation, session.endLocation);
//   // → 4820  (user is 4.8km from the destination)
// ---------------------------------------------------------------------------
