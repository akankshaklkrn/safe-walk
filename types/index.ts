export type CommuteMode = 'walking' | 'car';
export type LocationPermissionStatus = 'undetermined' | 'granted' | 'denied';
export type CheckInFrequency = '5min' | '10min' | 'smart';

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phoneNumber: string;
  email: string;
  relationship?: string;
  isPrimary: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string | null;
  safeWord?: string;
  recentSearches?: string[];
}

export interface TripSetupData {
  destination: string;
  mode: CommuteMode;
  currentLocation: Location | null;
  locationPermissionStatus: LocationPermissionStatus;
  emergencyContacts: EmergencyContact[];
  checkInFrequency: CheckInFrequency;
  isSilentMode: boolean;
  routeDeviationAlerts: boolean;
}

export interface RouteMetrics {
  directness: 'high' | 'medium' | 'low';
  turnCount: number;
  intersectionCount: number;
  activityLevel: 'high' | 'medium' | 'low';
  mainRoadExposure: 'high' | 'medium' | 'low';
  nearbyStops: number;
}

export interface Route {
  id: string;
  name: string;
  eta: string;
  distance: string;
  observation: string;
  metrics?: RouteMetrics;
}

export interface Trip {
  id: string;
  destination: string;
  selectedRoute: Route;
  status: 'safe' | 'uncertain' | 'risk';
  startedAt: Date;
  mode: CommuteMode;
}

export type SafetyStatus = 'safe' | 'uncertain' | 'risk';

export interface RouteSummaryInput {
  destination: string;
  mode: CommuteMode;
  routes: Route[];
}

export interface RouteObservation {
  routeId: string;
  observation: string;
}

export interface RouteSummaryResponse {
  provider: 'mock' | 'perplexity' | 'gemini';
  observations: RouteObservation[];
  overallComparison: string;
  fallbackUsed: boolean;
}

export interface VoicePromptInput {
  destination: string;
  routeName: string;
  eta: string;
  safetyStatus: SafetyStatus;
}

export interface VoicePromptResponse {
  provider: 'mock' | 'elevenlabs-ready';
  script: string;
  audioUrl: string | null;
  fallbackUsed: boolean;
}
