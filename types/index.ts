export type CommuteMode = 'walking' | 'car';

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
  provider: 'mock' | 'perplexity-ready';
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
