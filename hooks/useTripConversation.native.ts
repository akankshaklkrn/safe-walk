import { TripConversationOptions, TripConversation } from './useTripConversation';

// @elevenlabs/react-native uses @livekit/react-native which requires native
// linking and a custom dev build — it cannot run inside Expo Go.
// This stub lets the rest of the app load normally in Expo Go; voice features
// are simply no-ops until a development build is used.
export function useTripConversation(_options: TripConversationOptions): TripConversation {
  return {
    startSession: async () => {
      console.warn('[SafeWalk] Voice companion requires a custom dev build (not Expo Go).');
    },
    endSession: async () => undefined,
    status: 'disconnected',
    isSpeaking: false,
    setMicMuted: () => undefined,
    sendUserMessage: () => undefined,
    sendContextualUpdate: () => undefined,
  };
}
