import { StatusError } from 'expo-server';

const ELEVENLABS_TOKEN_URL = 'https://api.elevenlabs.io/v1/convai/conversation/token';

export async function GET(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new StatusError(501, {
      error: 'ELEVENLABS_API_KEY is not configured',
    });
  }

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agent_id');
  const participantName = searchParams.get('participant_name');

  if (!agentId) {
    throw new StatusError(400, {
      error: 'agent_id is required',
    });
  }

  const upstreamUrl = new URL(ELEVENLABS_TOKEN_URL);
  upstreamUrl.searchParams.set('agent_id', agentId);

  if (participantName) {
    upstreamUrl.searchParams.set('participant_name', participantName);
  }

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method: 'GET',
    headers: {
      'xi-api-key': apiKey,
    },
  });

  if (!upstreamResponse.ok) {
    const errorText = await upstreamResponse.text();

    throw new StatusError(upstreamResponse.status, {
      error: 'Failed to create ElevenLabs conversation token',
      details: errorText,
    });
  }

  const payload = await upstreamResponse.json();

  return Response.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
