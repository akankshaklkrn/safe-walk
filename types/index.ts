export type CommuteMode = 'walking' | 'car';

export interface Route {
  id: string;
  name: string;
  eta: string;
  distance: string;
  observation: string;
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
