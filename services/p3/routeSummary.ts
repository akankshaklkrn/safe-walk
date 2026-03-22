import { Route, RouteSummaryInput, RouteSummaryResponse } from '../../types';

const EMPTY_SUMMARY: RouteSummaryResponse = {
  provider: 'rules',
  observations: [],
  overallComparison: 'Route notes based on ETA, route changes, and road characteristics.',
  fallbackUsed: false,
};

const describeByRank = (route: Route, routes: Route[]): string | null => {
  const metrics = route.metrics;
  const rankedByDirectness = [...routes].sort((a, b) => {
    const aScore = a.metrics?.directness === 'high' ? 3 : a.metrics?.directness === 'medium' ? 2 : 1;
    const bScore = b.metrics?.directness === 'high' ? 3 : b.metrics?.directness === 'medium' ? 2 : 1;
    return bScore - aScore;
  });
  const rankedByActivity = [...routes].sort((a, b) => {
    const aScore = (a.metrics?.nearbyPlaceCount ?? 0) + (a.metrics?.activityLevel === 'high' ? 3 : a.metrics?.activityLevel === 'medium' ? 1 : 0);
    const bScore = (b.metrics?.nearbyPlaceCount ?? 0) + (b.metrics?.activityLevel === 'high' ? 3 : b.metrics?.activityLevel === 'medium' ? 1 : 0);
    return bScore - aScore;
  });
  const rankedByComplexity = [...routes].sort((a, b) => {
    const aScore = (a.metrics?.turnCount ?? 0) + (a.metrics?.stepCount ?? 0);
    const bScore = (b.metrics?.turnCount ?? 0) + (b.metrics?.stepCount ?? 0);
    return aScore - bScore;
  });

  if (!metrics || routes.length <= 1) {
    return null;
  }

  if (rankedByDirectness[0]?.id === route.id) {
    return 'Most direct option with fewer route changes.';
  }

  if (rankedByActivity[0]?.id === route.id) {
    return metrics.mainRoadExposure === 'high'
      ? 'Uses busier road segments with more activity nearby.'
      : 'Passes more active places and landmarks along the way.';
  }

  if (rankedByComplexity[0]?.id === route.id) {
    return 'Simplest to follow with fewer step changes overall.';
  }

  return null;
};

const buildObservation = (route: Route, routes: Route[]): string => {
  const metrics = route.metrics;
  if (!metrics) {
    return `${route.name} follows a clear path to the destination.`;
  }

  const rankDescription = describeByRank(route, routes);
  if (rankDescription) {
    return rankDescription;
  }

  if (metrics.areaCharacter === 'residential' && metrics.mainRoadExposure === 'low') {
    return 'Stays more on side streets with a quieter street pattern.';
  }

  if (metrics.turnCount >= 6 || metrics.stepCount >= 10) {
    return 'Has more route changes to keep track of during the trip.';
  }

  if (metrics.mainRoadExposure === 'high') {
    return 'Uses more continuous main-road segments for most of the route.';
  }

  if (metrics.nearbyPlaceCount >= 4) {
    return 'Passes more place and landmark signals along the route.';
  }

  return 'Balanced route with a steady mix of directness and route changes.';
};

const buildOverallComparison = (routes: Route[]): string => {
  if (routes.length === 0) {
    return EMPTY_SUMMARY.overallComparison;
  }

  const directRoute = [...routes].sort((a, b) => {
    const aScore = a.metrics?.directness === 'high' ? 3 : a.metrics?.directness === 'medium' ? 2 : 1;
    const bScore = b.metrics?.directness === 'high' ? 3 : b.metrics?.directness === 'medium' ? 2 : 1;
    return bScore - aScore;
  })[0];
  const busyRoute = [...routes].sort((a, b) =>
    ((b.metrics?.nearbyPlaceCount ?? 0) + (b.metrics?.activityLevel === 'high' ? 3 : b.metrics?.activityLevel === 'medium' ? 1 : 0)) -
    ((a.metrics?.nearbyPlaceCount ?? 0) + (a.metrics?.activityLevel === 'high' ? 3 : a.metrics?.activityLevel === 'medium' ? 1 : 0))
  )[0];
  const simpleRoute = [...routes].sort((a, b) =>
    ((a.metrics?.turnCount ?? 0) + (a.metrics?.stepCount ?? 0)) -
    ((b.metrics?.turnCount ?? 0) + (b.metrics?.stepCount ?? 0))
  )[0];

  const uniqueRouteNames = new Set([directRoute?.name, busyRoute?.name, simpleRoute?.name].filter(Boolean));

  if (uniqueRouteNames.size === 1 && directRoute) {
    return `${directRoute.name} is the most direct, while the other options differ more in activity level and route complexity.`;
  }

  const parts = [
    directRoute ? `${directRoute.name} is the most direct` : null,
    busyRoute && busyRoute.name !== directRoute?.name ? `${busyRoute.name} has more place activity` : null,
    simpleRoute && simpleRoute.name !== directRoute?.name && simpleRoute.name !== busyRoute?.name
      ? `${simpleRoute.name} should be simplest to follow`
      : null,
  ].filter(Boolean);

  return parts.length > 0 ? `${parts.join(', ')}.` : EMPTY_SUMMARY.overallComparison;
};

const buildRuleSummary = (input: RouteSummaryInput): RouteSummaryResponse => ({
  provider: 'rules',
  observations: input.routes.map((route) => ({
    routeId: route.id,
    observation: buildObservation(route, input.routes),
  })),
  overallComparison: buildOverallComparison(input.routes),
  fallbackUsed: false,
});

export const generateRouteSummary = async (
  input: RouteSummaryInput,
): Promise<RouteSummaryResponse> => {
  return buildRuleSummary(input);
};

export const generateMockRouteSummary = (input: RouteSummaryInput): RouteSummaryResponse =>
  buildRuleSummary(input);

export const applyRouteObservations = (input: RouteSummaryInput): Route[] => {
  const summary = buildRuleSummary(input);
  const observationMap = new Map(summary.observations.map((observation) => [observation.routeId, observation.observation]));

  return input.routes.map((route) => ({
    ...route,
    observation: observationMap.get(route.id) ?? route.observation,
  }));
};
