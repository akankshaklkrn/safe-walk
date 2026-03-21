import { Route, CommuteMode } from '../types';

export const getMockRoutes = (destination: string, mode: CommuteMode): Route[] => {
  if (mode === 'car') {
    return [
      {
        id: '1',
        name: 'Fastest Route',
        eta: '5 min',
        distance: '2.1 mi',
        observation: 'Highway route with minimal traffic lights',
      },
      {
        id: '2',
        name: 'Recommended Route',
        eta: '7 min',
        distance: '2.3 mi',
        observation: 'Main roads with better visibility and lighting',
      },
      {
        id: '3',
        name: 'Scenic Route',
        eta: '9 min',
        distance: '2.8 mi',
        observation: 'Residential streets with lower speed limits',
      },
    ];
  }

  return [
    {
      id: '1',
      name: 'Fastest Route',
      eta: '12 min',
      distance: '0.8 mi',
      observation: 'More continuous walking with fewer stops',
    },
    {
      id: '2',
      name: 'Recommended Route',
      eta: '15 min',
      distance: '0.9 mi',
      observation: 'Passes through more active commercial areas',
    },
    {
      id: '3',
      name: 'Scenic Route',
      eta: '18 min',
      distance: '1.1 mi',
      observation: 'Has more turns and intersections',
    },
  ];
};
