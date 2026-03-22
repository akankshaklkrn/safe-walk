import { VoicePromptInput, VoicePromptResponse } from '../../types';

export interface ElevenLabsVoiceRequest {
  text: string;
  model_id: string;
  voice_settings: {
    stability: number;
    similarity_boost: number;
  };
}

const buildStatusLine = (input: VoicePromptInput) => {
  if (input.safetyStatus === 'risk') {
    return 'I noticed a risk signal. If you need help, use SOS now.';
  }

  if (input.safetyStatus === 'uncertain') {
    return 'I am checking in a little more closely while we keep moving.';
  }

  return 'Everything looks steady so far.';
};

export const buildCompanionScript = (input: VoicePromptInput) => {
  return [
    `Heading to ${input.destination} on ${input.routeName}.`,
    `${input.eta} remaining.`,
    buildStatusLine(input),
  ].join(' ');
};

export const buildElevenLabsRequest = (
  input: VoicePromptInput,
  modelId = 'eleven_turbo_v2_5'
): ElevenLabsVoiceRequest => {
  return {
    text: buildCompanionScript(input),
    model_id: modelId,
    voice_settings: {
      stability: 0.55,
      similarity_boost: 0.75,
    },
  };
};

export const generateVoicePrompt = (input: VoicePromptInput): VoicePromptResponse => {
  return {
    provider: 'mock',
    script: buildCompanionScript(input),
    audioUrl: null,
    fallbackUsed: true,
  };
};
