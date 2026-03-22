export type TripStatus = 'GREEN' | 'YELLOW' | 'RED';

// Single source of truth lives in maps.ts — aliased here for trip code
import { CommuteMode, LatLng } from './maps';
export type TravelMode = CommuteMode;

export interface Location {
  lat: number;
  lng: number;
}

export interface TrustedContact {
  name: string;
  phone: string;
  email?: string;
}

export interface Trip {
  // ── Session identity (mirrors TripSession fields) ─────────────────────
  tripId: string;
  routeId: string;      // which RouteOption the user picked
  userId: string;
  destination: string;
  mode: TravelMode;
  trustedContact: TrustedContact;

  // ── Route geometry (used by riskEngine for deviation checks) ──────────
  plannedRoute: Location[];   // waypoints from the selected RouteOption
  endLocation: LatLng;        // the route's final point — used for destination detection

  // ── Mutable live state ─────────────────────────────────────────────────
  currentLocation: Location | null;
  startTime: Date;
  lastLocationUpdate: Date | null;
  lastResponseTime: Date;
  status: TripStatus;

  // ── Completion (Milestone 7) ────────────────────────────────────────────
  /**
   * Set once when isDestinationReached() first returns true.
   * Null for all in-progress trips.
   */
  completedAt: Date | null;

  // ── Risk flags ──────────────────────────────────────────────────────────
  escalated: boolean;
  checkInSent: boolean;
  checkInSentAt: Date | null;
  sosTriggered: boolean;
  dangerWordTriggered: boolean;
  alertLog: string[];

  // ── Recovery tracking (Milestone 6) ────────────────────────────────────
  /**
   * Number of consecutive on-route location updates in the current streak.
   * Reset to 0 whenever the user goes off-route ('warning' or 'critical').
   * Used by detectRecovery() to implement hysteresis.
   */
  consecutiveOnRouteCount: number;

  /**
   * True after the user's deviation level has been 'warning' or 'critical'
   * at least once since the last confirmed rejoin (or trip start).
   * Cleared when detectRecovery() fires rejoinedRoute.
   */
  wasOffRoute: boolean;
}
