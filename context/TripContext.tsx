import { createContext, useContext, useState, ReactNode } from 'react';
import { TripSetupData, CommuteMode, Location, LocationPermissionStatus, EmergencyContact } from '../types';

interface TripContextType {
  tripSetupData: TripSetupData | null;
  updateTripSetup: (data: Partial<TripSetupData>) => void;
  resetTripSetup: () => void;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

export function TripProvider({ children }: { children: ReactNode }) {
  const [tripSetupData, setTripSetupData] = useState<TripSetupData | null>(null);

  const updateTripSetup = (data: Partial<TripSetupData>) => {
    setTripSetupData((prev) => {
      if (!prev) {
        return {
          destination: data.destination || '',
          mode: data.mode || 'walking',
          currentLocation: data.currentLocation || null,
          locationPermissionStatus: data.locationPermissionStatus || 'undetermined',
          emergencyContacts: data.emergencyContacts || [],
        };
      }
      return { ...prev, ...data };
    });
  };

  const resetTripSetup = () => {
    setTripSetupData(null);
  };

  return (
    <TripContext.Provider value={{ tripSetupData, updateTripSetup, resetTripSetup }}>
      {children}
    </TripContext.Provider>
  );
}

export function useTripContext() {
  const context = useContext(TripContext);
  if (context === undefined) {
    throw new Error('useTripContext must be used within a TripProvider');
  }
  return context;
}
