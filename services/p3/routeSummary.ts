import { Route, RouteSummaryInput, RouteSummaryResponse } from '../../types';

const describeDirectness = (route: Route) => {
  const directness = route.metrics?.directness;

  if (directness === 'high') {
    return 'More direct route';
  }

  if (directness === 'medium') {
    return 'Balanced route with a straightforward pace';
  }

  return 'Slightly longer path with more route changes';
};

const describeComplexity = (route: Route) => {
  const turns = route.metrics?.turnCount ?? 0;
  const intersections = route.metrics?.intersectionCount ?? 0;
  const totalChanges = turns + intersections;

  if (totalChanges <= 8) {
    return 'Fewer turns and intersections';
  }

  if (totalChanges <= 14) {
    return 'Moderate number of turns along the way';
  }

  return 'More turns and intersections to manage';
};

const describeActivity = (route: Route) => {
  const activityLevel = route.metrics?.activityLevel;
  const stops = route.metrics?.nearbyStops ?? 0;
  const mainRoadExposure = route.metrics?.mainRoadExposure;

  if (activityLevel === 'high' || stops >= 6) {
    return 'Passes more active public places';
  }

  if (mainRoadExposure === 'high') {
    return 'Includes more main-road walking';
  }

  if (activityLevel === 'low') {
    return 'Goes through quieter streets';
  }

  return 'Mix of busier stretches and calmer blocks';
};

const buildObservation = (route: Route) => {
  const observationOptions = [
    describeDirectness(route),
    describeComplexity(route),
    describeActivity(route),
  ];

  return observationOptions.find(Boolean) ?? 'Route offers a steady walk to your destination';
};

const buildOverallComparison = (routes: Route[]) => {
  if (routes.length === 0) {
    return 'No route comparison available.';
  }

  const mostDirectRoute = [...routes].sort((a, b) => {
    const score = { high: 3, medium: 2, low: 1 };
    return (score[b.metrics?.directness ?? 'low'] - score[a.metrics?.directness ?? 'low']);
  })[0];

  const busiestRoute = [...routes].sort((a, b) => {
    const score = { high: 3, medium: 2, low: 1 };
    return (score[b.metrics?.activityLevel ?? 'low'] - score[a.metrics?.activityLevel ?? 'low']);
  })[0];

  const simplestRoute = [...routes].sort((a, b) => {
    const aChanges = (a.metrics?.turnCount ?? 0) + (a.metrics?.intersectionCount ?? 0);
    const bChanges = (b.metrics?.turnCount ?? 0) + (b.metrics?.intersectionCount ?? 0);
    return aChanges - bChanges;
  })[0];

  return `${mostDirectRoute.name} is the most direct, ${busiestRoute.name} looks more active, and ${simplestRoute.name} should feel simpler to follow.`;
};

export const buildPerplexityRouteSummaryPrompt = (input: RouteSummaryInput) => {
  const routeLines = input.routes.map((route) => {
    const metrics = route.metrics;

    return [
      `Route: ${route.name}`,
      `ETA: ${route.eta}`,
      `Distance: ${route.distance}`,
      `Directness: ${metrics?.directness ?? 'unknown'}`,
      `Turns: ${metrics?.turnCount ?? 0}`,
      `Intersections: ${metrics?.intersectionCount ?? 0}`,
      `Activity level: ${metrics?.activityLevel ?? 'unknown'}`,
      `Main-road exposure: ${metrics?.mainRoadExposure ?? 'unknown'}`,
      `Nearby stops/businesses: ${metrics?.nearbyStops ?? 0}`,
    ].join('\n');
  });

  return [
    `You are writing short route observations for a SafeWalk ${input.mode} trip to ${input.destination}.`,
    'Generate exactly 1 observation per route and 1 overall comparison.',
    'Do not call any route safe or unsafe.',
    'Focus on directness, activity level, and complexity.',
    'Keep each observation under 14 words.',
    '',
    routeLines.join('\n\n'),
  ].join('\n');
};

export const generateRouteSummary = (input: RouteSummaryInput): RouteSummaryResponse => {
  return {
    provider: 'mock',
    observations: input.routes.map((route) => ({
      routeId: route.id,
      observation: buildObservation(route),
    })),
    overallComparison: buildOverallComparison(input.routes),
    fallbackUsed: true,
  };
};

export const applyRouteObservations = (input: RouteSummaryInput): Route[] => {
  const summary = generateRouteSummary(input);
  const observationMap = new Map(
    summary.observations.map((item) => [item.routeId, item.observation])
  );

  return input.routes.map((route) => ({
    ...route,
    observation:
      observationMap.get(route.id) ?? route.observation ?? 'Route details unavailable',
  }));
};
