import { StatusError } from 'expo-server';
import { buildElevenLabsRequest, generateVoicePrompt } from '../../services/p3';
import { SafetyStatus, VoicePromptInput } from '../../types';

const isSafetyStatus = (value: unknown): value is SafetyStatus => {
  return value === 'safe' || value === 'uncertain' || value === 'risk';
};

const parseRequest = async (request: Request): Promise<VoicePromptInput> => {
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

  const { destination, routeName, eta, safetyStatus } = body as Partial<VoicePromptInput>;

  if (typeof destination !== 'string' || !destination.trim()) {
    throw new StatusError(400, 'destination is required');
  }

  if (typeof routeName !== 'string' || !routeName.trim()) {
    throw new StatusError(400, 'routeName is required');
  }

  if (typeof eta !== 'string' || !eta.trim()) {
    throw new StatusError(400, 'eta is required');
  }

  if (!isSafetyStatus(safetyStatus)) {
    throw new StatusError(400, 'safetyStatus must be "safe", "uncertain", or "risk"');
  }

  return {
    destination: destination.trim(),
    routeName: routeName.trim(),
    eta: eta.trim(),
    safetyStatus,
  };
};

export async function POST(request: Request) {
  const input = await parseRequest(request);
  const voicePrompt = generateVoicePrompt(input);
  const elevenLabsRequest = buildElevenLabsRequest(input);

  return Response.json(
    {
      ...voicePrompt,
      elevenLabsRequest,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

export function GET() {
  return Response.json(
    {
      endpoint: '/api/voice',
      method: 'POST',
      body: {
        destination: 'Library',
        routeName: 'Recommended Route',
        eta: '12 min',
        safetyStatus: 'safe',
      },
    },
    { status: 200 }
  );
}
