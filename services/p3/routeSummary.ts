import { Route, RouteSummaryInput, RouteSummaryResponse } from '../../types';

// ── Rule-based fallback descriptions ─────────────────────────────────────────

const describeDirectness = (route: Route) => {
  const d = route.metrics?.directness;
  if (d === 'high')   return 'More direct route';
  if (d === 'medium') return 'Balanced route with a straightforward pace';
  return 'Slightly longer path with more route changes';
};

const describeComplexity = (route: Route) => {
  const total = (route.metrics?.turnCount ?? 0) + (route.metrics?.intersectionCount ?? 0);
  if (total <= 8)  return 'Fewer turns and intersections';
  if (total <= 14) return 'Moderate number of turns along the way';
  return 'More turns and intersections to manage';
};

const describeActivity = (route: Route) => {
  const level  = route.metrics?.activityLevel;
  const stops  = route.metrics?.nearbyStops ?? 0;
  const roads  = route.metrics?.mainRoadExposure;
  if (level === 'high' || stops >= 6) return 'Passes more active public places';
  if (roads === 'high')               return 'Includes more main-road walking';
  if (level === 'low')                return 'Goes through quieter streets';
  return 'Mix of busier stretches and calmer blocks';
};

const buildObservation = (route: Route) =>
  [describeDirectness(route), describeComplexity(route), describeActivity(route)]
    .find(Boolean) ?? 'Route offers a steady walk to your destination';

const buildOverallComparison = (routes: Route[]) => {
  if (routes.length === 0) return 'No route comparison available.';
  const score = (v: string | undefined) => ({ high: 3, medium: 2, low: 1 }[v ?? 'low'] ?? 1);
  const mostDirect  = [...routes].sort((a, b) => score(b.metrics?.directness)  - score(a.metrics?.directness))[0];
  const busiest     = [...routes].sort((a, b) => score(b.metrics?.activityLevel) - score(a.metrics?.activityLevel))[0];
  const simplest    = [...routes].sort((a, b) =>
    ((a.metrics?.turnCount ?? 0) + (a.metrics?.intersectionCount ?? 0)) -
    ((b.metrics?.turnCount ?? 0) + (b.metrics?.intersectionCount ?? 0))
  )[0];
  return `${mostDirect.name} is the most direct, ${busiest.name} looks more active, and ${simplest.name} should feel simpler to follow.`;
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

// ── Gemini helpers ────────────────────────────────────────────────────────────

const buildGeminiPrompt = (input: RouteSummaryInput): string => {
  const routeLines = input.routes.map((route) => [
    `routeId: ${route.id}`,
    `Route: ${route.name}`,
    `ETA: ${route.eta}`,
    `Distance: ${route.distance}`,
    `Directness: ${route.metrics?.directness ?? 'unknown'}`,
    `Turns: ${route.metrics?.turnCount ?? 0}`,
    `Intersections: ${route.metrics?.intersectionCount ?? 0}`,
    `Activity level: ${route.metrics?.activityLevel ?? 'unknown'}`,
    `Main-road exposure: ${route.metrics?.mainRoadExposure ?? 'unknown'}`,
    `Nearby stops/businesses: ${route.metrics?.nearbyStops ?? 0}`,
  ].join('\n'));

  return [
    'Return strict JSON only. No markdown, no extra prose.',
    'Schema: {"observations":[{"routeId":"string","observation":"string"}],"overallComparison":"string"}',
    'Each routeId MUST exactly match the routeId value given in the input.',
    'Do not call any route safe or unsafe.',
    `You are writing short route observations for a SafeWalk ${input.mode} trip to ${input.destination}.`,
    'Generate exactly 1 observation per route (under 14 words) and 1 overall comparison.',
    '',
    routeLines.join('\n\n'),
  ].join('\n');
};

const parseGeminiResponse = (
  content: string,
): Pick<RouteSummaryResponse, 'observations' | 'overallComparison'> | null => {
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
      .filter((item): item is { routeId: string; observation: string } =>
        typeof item.routeId === 'string' && typeof item.observation === 'string'
      )
      .map((item) => ({ routeId: item.routeId, observation: item.observation.trim() }));

    return observations.length > 0
      ? { observations, overallComparison: parsed.overallComparison.trim() }
      : null;
  } catch {
    return null;
  }
};

// ── Public API ────────────────────────────────────────────────────────────────

export const generateRouteSummary = async (
  input: RouteSummaryInput,
): Promise<RouteSummaryResponse> => {
  // Works both server-side (GEMINI_API_KEY) and client-side (EXPO_PUBLIC_GEMINI_API_KEY)
  const apiKey =
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return buildMockRouteSummary(input);
  }

  const model = process.env.EXPO_PUBLIC_GEMINI_MODEL ?? process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents:         [{ parts: [{ text: buildGeminiPrompt(input) }] }],
        generationConfig: { temperature: 0.2 },
      }),
    });

    if (!response.ok) {
      console.warn('[SafeWalk] Gemini route summary failed:', response.status);
      return buildMockRouteSummary(input);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.warn('[SafeWalk] Gemini returned empty content');
      return buildMockRouteSummary(input);
    }

    const parsed = parseGeminiResponse(content);
    if (!parsed) {
      console.warn('[SafeWalk] Gemini response could not be parsed:', content.slice(0, 200));
      return buildMockRouteSummary(input);
    }

    const validIds     = new Set(input.routes.map((r) => r.id));
    const observations = parsed.observations.filter((o) => validIds.has(o.routeId));

    if (observations.length === 0) {
      console.warn('[SafeWalk] Gemini routeIds did not match input ids');
      return buildMockRouteSummary(input);
    }

    console.log('[SafeWalk] Gemini route insights OK');
    return { provider: 'gemini', observations, overallComparison: parsed.overallComparison, fallbackUsed: false };
  } catch (err) {
    console.warn('[SafeWalk] Gemini fetch error:', err);
    return buildMockRouteSummary(input);
  }
};

export const generateMockRouteSummary = (input: RouteSummaryInput): RouteSummaryResponse =>
  buildMockRouteSummary(input);

export const applyRouteObservations = (input: RouteSummaryInput): Route[] => {
  const summary        = buildMockRouteSummary(input);
  const observationMap = new Map(summary.observations.map((o) => [o.routeId, o.observation]));
  return input.routes.map((route) => ({
    ...route,
    observation: observationMap.get(route.id) ?? route.observation ?? 'Route details unavailable',
  }));
};
