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
            directness: 'high',
            turnCount: 2,
            intersectionCount: 3,
            activityLevel: 'medium',
            mainRoadExposure: 'high',
            nearbyStops: 3,
          },
        },
        {
          id: '2',
          name: 'Recommended Route',
          eta: '7 min',
          distance: '2.3 mi',
          observation: '',
          metrics: {
            directness: 'medium',
            turnCount: 4,
            intersectionCount: 4,
            activityLevel: 'high',
            mainRoadExposure: 'medium',
            nearbyStops: 7,
          },
        },
        {
          id: '3',
          name: 'Scenic Route',
          eta: '9 min',
          distance: '2.8 mi',
          observation: '',
          metrics: {
            directness: 'low',
            turnCount: 6,
            intersectionCount: 5,
            activityLevel: 'low',
            mainRoadExposure: 'low',
            nearbyStops: 2,
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
            directness: 'high',
            turnCount: 2,
            intersectionCount: 4,
            activityLevel: 'medium',
            mainRoadExposure: 'medium',
            nearbyStops: 4,
          },
        },
        {
          id: '2',
          name: 'Recommended Route',
          eta: '15 min',
          distance: '0.9 mi',
          observation: '',
          metrics: {
            directness: 'medium',
            turnCount: 4,
            intersectionCount: 5,
            activityLevel: 'high',
            mainRoadExposure: 'high',
            nearbyStops: 8,
          },
        },
        {
          id: '3',
          name: 'Scenic Route',
          eta: '18 min',
          distance: '1.1 mi',
          observation: '',
          metrics: {
            directness: 'low',
            turnCount: 6,
            intersectionCount: 7,
            activityLevel: 'low',
            mainRoadExposure: 'low',
            nearbyStops: 2,
          },
        },
      ];

  return applyRouteObservations({
    destination,
    mode,
    routes: baseRoutes,
  });
};
