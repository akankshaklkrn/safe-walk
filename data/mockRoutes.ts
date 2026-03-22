import { Route, CommuteMode } from '../types';
import { applyRouteObservations } from '../services/p3';

export const getMockRoutes = (destination: string, mode: CommuteMode): Route[] => {
  const baseRoutes: Route[] = mode === 'car'
    ? [
        {
          id: '1',
          name: 'Fastest Route',
          eta: '5 min',
          distance: '2.1 mi',
          observation: '',
          metrics: {
            stepCount: 5,
            directness: 'high',
            turnCount: 2,
            intersectionCount: 3,
            activityLevel: 'medium',
            mainRoadExposure: 'high',
            mainRoadRatio: 0.68,
            nearbyPlaceCount: 3,
            areaCharacter: 'mixed',
          },
        },
        {
          id: '2',
          name: 'Recommended Route',
          eta: '7 min',
          distance: '2.3 mi',
          observation: '',
          metrics: {
            stepCount: 7,
            directness: 'medium',
            turnCount: 4,
            intersectionCount: 4,
            activityLevel: 'high',
            mainRoadExposure: 'medium',
            mainRoadRatio: 0.42,
            nearbyPlaceCount: 7,
            areaCharacter: 'commercial',
          },
        },
        {
          id: '3',
          name: 'Scenic Route',
          eta: '9 min',
          distance: '2.8 mi',
          observation: '',
          metrics: {
            stepCount: 9,
            directness: 'low',
            turnCount: 6,
            intersectionCount: 5,
            activityLevel: 'low',
            mainRoadExposure: 'low',
            mainRoadRatio: 0.21,
            nearbyPlaceCount: 2,
            areaCharacter: 'residential',
          },
        },
      ]
    : [
        {
          id: '1',
          name: 'Fastest Route',
          eta: '12 min',
          distance: '0.8 mi',
          observation: '',
          metrics: {
            stepCount: 6,
            directness: 'high',
            turnCount: 2,
            intersectionCount: 4,
            activityLevel: 'medium',
            mainRoadExposure: 'medium',
            mainRoadRatio: 0.49,
            nearbyPlaceCount: 4,
            areaCharacter: 'mixed',
          },
        },
        {
          id: '2',
          name: 'Recommended Route',
          eta: '15 min',
          distance: '0.9 mi',
          observation: '',
          metrics: {
            stepCount: 8,
            directness: 'medium',
            turnCount: 4,
            intersectionCount: 5,
            activityLevel: 'high',
            mainRoadExposure: 'high',
            mainRoadRatio: 0.61,
            nearbyPlaceCount: 8,
            areaCharacter: 'commercial',
          },
        },
        {
          id: '3',
          name: 'Scenic Route',
          eta: '18 min',
          distance: '1.1 mi',
          observation: '',
          metrics: {
            stepCount: 11,
            directness: 'low',
            turnCount: 6,
            intersectionCount: 7,
            activityLevel: 'low',
            mainRoadExposure: 'low',
            mainRoadRatio: 0.18,
            nearbyPlaceCount: 2,
            areaCharacter: 'residential',
          },
        },
      ];

  return applyRouteObservations({
    destination,
    mode,
    routes: baseRoutes,
  });
};
