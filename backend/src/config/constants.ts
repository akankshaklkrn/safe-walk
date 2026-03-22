import { Location } from '../types/trip';
import { CommuteMode } from '../types/maps';

// Hardcoded walking route — replace with Google Maps response later.
// These waypoints simulate a ~800m walk through lower Manhattan.
export const HARDCODED_ROUTE: Location[] = [
  { lat: 40.7128, lng: -74.0060 }, // Start
  { lat: 40.7133, lng: -74.0055 },
  { lat: 40.7139, lng: -74.0048 },
  { lat: 40.7146, lng: -74.0040 },
  { lat: 40.7153, lng: -74.0032 },
  { lat: 40.7160, lng: -74.0025 }, // End / destination
];

export const RISK: Record<CommuteMode, {
  DEVIATION_YELLOW_M: number;
  DEVIATION_RED_M: number;
  INACTIVITY_YELLOW_MS: number;
  INACTIVITY_RED_MS: number;
  CHECKIN_TIMEOUT_MS: number;
}> = {
  walking: {
    DEVIATION_YELLOW_M: 120,          // ~1 full city block before check-in prompt
    DEVIATION_RED_M: 300,             // clearly off route (2+ blocks)
    INACTIVITY_YELLOW_MS: 3 * 60 * 1000,   // 3 min
    INACTIVITY_RED_MS: 6 * 60 * 1000,      // 6 min
    CHECKIN_TIMEOUT_MS: 60 * 1000,         // 60s to respond
  },
  car: {
    DEVIATION_YELLOW_M: 100,          // one-way streets, parking, traffic re-routes
    DEVIATION_RED_M: 400,
    INACTIVITY_YELLOW_MS: 5 * 60 * 1000,   // stopped in traffic is normal
    INACTIVITY_RED_MS: 10 * 60 * 1000,     // 10 min stopped → concern
    CHECKIN_TIMEOUT_MS: 90 * 1000,         // 90s — harder to tap while driving
  },
};
