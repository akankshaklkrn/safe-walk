import { v4 as uuidv4 } from 'uuid';
import { RISK } from '../config/constants';
import { Trip } from '../types/trip';
import { TripSession, StartTripParams } from '../types/session';

// ---------------------------------------------------------------------------
// buildTrip — Milestone 2 core function
//
// Accepts the user's selected route and returns two things:
//
//   session — the clean, serialisable object sent to the frontend.
//             Contains everything the UI needs: thresholds, geometry, ETA.
//             This is what POST /start-trip returns.
//
//   trip    — the internal state object stored in tripStore.
//             Extends the session facts with mutable risk fields
//             (escalated, checkInSent, etc.) used by the live monitoring layer.
//
// Both are created from the same params in one call so they are always in sync.
// ---------------------------------------------------------------------------

export function buildTrip(params: StartTripParams): {
  session: TripSession;
  trip: Trip;
} {
  const { userId, destination, trustedContact, selectedRoute } = params;

  const tripId    = uuidv4();
  const now       = new Date();
  const thresholds = RISK[selectedRoute.mode];

  // ── Build the clean session object ──────────────────────────────────────
  // This is serialised directly to JSON and sent to the frontend.
  const session: TripSession = {
    tripId,
    routeId:    selectedRoute.id,
    userId,
    mode:       selectedRoute.mode,
    destination,
    startedAt:  now.toISOString(),
    status:     'GREEN',

    expectedEtaMinutes: selectedRoute.etaMinutes,

    // Pre-resolved thresholds so the frontend doesn't need to know about
    // the RISK constants. It can use these for map UI rings or warnings.
    deviationThresholdMeters: {
      yellow: thresholds.DEVIATION_YELLOW_M,
      red:    thresholds.DEVIATION_RED_M,
    },
    inactivityThresholdMs: {
      yellow: thresholds.INACTIVITY_YELLOW_MS,
      red:    thresholds.INACTIVITY_RED_MS,
    },
    checkInTimeoutMs: thresholds.CHECKIN_TIMEOUT_MS,

    // Route geometry from the selected RouteOption — no hardcoded fallback
    routePolyline: selectedRoute.polyline,
    waypoints:     selectedRoute.waypoints,
    startLocation: selectedRoute.startLocation,
    endLocation:   selectedRoute.endLocation,

    trustedContact,
  };

  // ── Build the internal trip object ──────────────────────────────────────
  // Stored in tripStore. The live monitoring layer reads and mutates this.
  // plannedRoute mirrors session.waypoints; the riskEngine uses Location[]
  // for haversine distance checks and they are structurally identical.
  const trip: Trip = {
    tripId,
    routeId:        selectedRoute.id,
    userId,
    destination,
    mode:           selectedRoute.mode,
    trustedContact,
    plannedRoute:   selectedRoute.waypoints,   // replaces HARDCODED_ROUTE
    endLocation:    selectedRoute.endLocation, // used by completionService
    expectedEtaMinutes: selectedRoute.etaMinutes, // for real-time ETA calculations
    currentLocation:     null,
    startTime:           now,
    lastLocationUpdate:  null,
    lastResponseTime:    now,
    completedAt:         null,                 // set by completionService on arrival
    status:     'GREEN',
    escalated:          false,
    checkInSent:        false,
    checkInSentAt:      null,
    sosTriggered:       false,
    dangerWordTriggered: false,
    alertLog: [`Trip started at ${now.toISOString()} via route "${selectedRoute.name}"`],
    // Milestone 6 — recovery tracking
    consecutiveOnRouteCount: 0,
    wasOffRoute:             false,
  };

  return { session, trip };
}

// ---------------------------------------------------------------------------
// toTripSession — converts a stored Trip back into a TripSession snapshot.
//
// Used by GET /status when the frontend needs a refreshed session view,
// and by Milestone 3 when returning live status updates.
// ---------------------------------------------------------------------------

export function toTripSession(trip: Trip, originalSession: TripSession): TripSession {
  // Status may have changed since start — reflect the latest value
  return { ...originalSession, status: trip.status };
}
