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

export interface EmergencyContact {
  id: string;
  name: string;
  phoneNumber: string;
  relationship?: string;
  isPrimary: boolean;
}

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export type LocationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface TripSetupData {
  destination: string;
  mode: CommuteMode;
  currentLocation: Location | null;
  locationPermissionStatus: LocationPermissionStatus;
  emergencyContacts: EmergencyContact[];
}
