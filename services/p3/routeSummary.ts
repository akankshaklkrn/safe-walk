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

const buildMockRouteSummary = (input: RouteSummaryInput): RouteSummaryResponse => ({
  provider: 'mock',
  observations: input.routes.map((route) => ({
    routeId: route.id,
    observation: buildObservation(route),
  })),
  overallComparison: buildOverallComparison(input.routes),
  fallbackUsed: true,
});

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

const parsePerplexityContent = (content: string): Pick<RouteSummaryResponse, 'observations' | 'overallComparison'> | null => {
  const normalized = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(normalized) as {
      observations?: Array<{ routeId?: string; observation?: string }>;
      overallComparison?: string;
    };

    if (!Array.isArray(parsed.observations) || typeof parsed.overallComparison !== 'string') {
      return null;
    }

    const observations = parsed.observations
      .filter((item): item is { routeId: string; observation: string } => (
        typeof item.routeId === 'string' && typeof item.observation === 'string'
      ))
      .map((item) => ({
        routeId: item.routeId,
        observation: item.observation.trim(),
      }));

    if (observations.length === 0) {
      return null;
    }

    return {
      observations,
      overallComparison: parsed.overallComparison.trim(),
    };
  } catch {
    return null;
  }
};

export const generateRouteSummary = async (
  input: RouteSummaryInput
): Promise<RouteSummaryResponse> => {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    return buildMockRouteSummary(input);
  }

  try {
    const response = await fetch('https://api.perplexity.ai/v1/sonar', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.PERPLEXITY_MODEL || 'sonar',
        messages: [
          {
            role: 'system',
            content:
              'Return strict JSON only. No markdown, no prose outside JSON. ' +
              'Schema: {"observations":[{"routeId":"string","observation":"string"}],"overallComparison":"string"}. ' +
              'Avoid calling any route safe or unsafe.',
          },
          {
            role: 'user',
            content: buildPerplexityRouteSummaryPrompt(input),
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      return buildMockRouteSummary(input);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return buildMockRouteSummary(input);
    }

    const parsed = parsePerplexityContent(content);

    if (!parsed) {
      return buildMockRouteSummary(input);
    }

    const validRouteIds = new Set(input.routes.map((route) => route.id));
    const observations = parsed.observations.filter((item) => validRouteIds.has(item.routeId));

    if (observations.length === 0) {
      return buildMockRouteSummary(input);
    }

    return {
      provider: 'perplexity',
      observations,
      overallComparison: parsed.overallComparison,
      fallbackUsed: false,
    };
  } catch {
    return buildMockRouteSummary(input);
  }
};

export const generateMockRouteSummary = (input: RouteSummaryInput): RouteSummaryResponse => {
  return buildMockRouteSummary(input);
};

export const applyRouteObservations = (input: RouteSummaryInput): Route[] => {
  const summary = buildMockRouteSummary(input);
  const observationMap = new Map(
    summary.observations.map((item) => [item.routeId, item.observation])
  );

  return input.routes.map((route) => ({
    ...route,
    observation:
      observationMap.get(route.id) ?? route.observation ?? 'Route details unavailable',
  }));
};
