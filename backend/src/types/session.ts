import { CommuteMode, LatLng, RouteOption } from './maps';
import { TripStatus, TrustedContact } from './trip';

// ---------------------------------------------------------------------------
// TripSession — the normalised session object returned to the frontend.
//
// Design rule: every field in TripSession is safe to return in an API response.
// Nothing mutable (risk flags, timestamps as Date objects) lives here.
// Downstream milestones (live monitoring, escalation) read from the internal
// Trip object in the store, not from TripSession.
// ---------------------------------------------------------------------------

export interface TripSession {
  // ── Identity ───────────────────────────────────────────────────────────
  tripId: string;
  routeId: string;       // id from the RouteOption the user selected
  userId: string;

  // ── Journey facts ──────────────────────────────────────────────────────
  mode: CommuteMode;
  destination: string;
  startedAt: string;           // ISO 8601 — serialisation-safe for JSON
  status: TripStatus;          // always 'GREEN' at creation

  // ── ETA ────────────────────────────────────────────────────────────────
  expectedEtaMinutes: number;

  // ── Deviation thresholds (mode-aware, pre-resolved for the frontend) ───
  // The frontend can use these to show threshold rings on the map
  // without needing to know the risk constants itself.
  deviationThresholdMeters: {
    yellow: number;    // soft warning — check-in prompt shown
    red: number;       // hard trigger — immediate escalation
  };

  // ── Inactivity thresholds (mode-aware) ─────────────────────────────────
  inactivityThresholdMs: {
    yellow: number;
    red: number;
  };

  // ── Check-in window ────────────────────────────────────────────────────
  checkInTimeoutMs: number;  // how long the user has to respond before RED

  // ── Route geometry — ready for map rendering ───────────────────────────
  routePolyline: string;     // Google encoded polyline
  waypoints: LatLng[];       // decoded points; pass directly to map component
  startLocation: LatLng;
  endLocation: LatLng;

  // ── Trusted contact (needed by escalation layer) ───────────────────────
  trustedContact: TrustedContact;
}

// ---------------------------------------------------------------------------
// StartTripParams — the input shape for tripService.buildTrip().
//
// The frontend must call POST /routes first to get a RouteOption,
// then pass the selected one here. This replaces the old hardcoded route.
// ---------------------------------------------------------------------------

export interface StartTripParams {
  userId: string;
  destination: string;          // the free-text string the user typed
  trustedContact: TrustedContact;
  selectedRoute: RouteOption;   // the full RouteOption chosen by the user
  currentLocation: LatLng;      // device GPS at the moment Start Trip is tapped
}
