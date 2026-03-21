import { StatusError } from 'expo-server';
import { generateRouteSummary } from '../../services/p3';
import { CommuteMode, Route, RouteSummaryInput } from '../../types';

const isCommuteMode = (value: unknown): value is CommuteMode => {
  return value === 'walking' || value === 'car';
};

const isRoute = (value: unknown): value is Route => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const route = value as Partial<Route>;

  return (
    typeof route.id === 'string' &&
    typeof route.name === 'string' &&
    typeof route.eta === 'string' &&
    typeof route.distance === 'string' &&
    typeof route.observation === 'string'
  );
};

const parseRequest = async (request: Request): Promise<RouteSummaryInput> => {
  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    throw new StatusError(400, {
      error: 'Request body must be valid JSON',
      cause: error,
    });
  }

  if (!body || typeof body !== 'object') {
    throw new StatusError(400, 'Request body is required');
  }

  const { destination, mode, routes } = body as Partial<RouteSummaryInput>;

  if (typeof destination !== 'string' || !destination.trim()) {
    throw new StatusError(400, 'destination is required');
  }

  if (!isCommuteMode(mode)) {
    throw new StatusError(400, 'mode must be "walking" or "car"');
  }

  if (!Array.isArray(routes) || routes.length === 0 || !routes.every(isRoute)) {
    throw new StatusError(400, 'routes must be a non-empty array of route objects');
  }

  return {
    destination: destination.trim(),
    mode,
    routes,
  };
};

export async function POST(request: Request) {
  const input = await parseRequest(request);
  const summary = generateRouteSummary(input);

  return Response.json(summary, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export function GET() {
  return Response.json(
    {
      endpoint: '/api/route-summary',
      method: 'POST',
      body: {
        destination: 'Library',
        mode: 'walking',
        routes: [
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
        ],
      },
    },
    { status: 200 }
  );
}
