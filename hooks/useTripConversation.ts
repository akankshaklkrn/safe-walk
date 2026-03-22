import { Platform } from 'react-native';

export interface TripConversationOptions {
  tokenFetchUrl?: string;
  onConnect?: (event: { conversationId: string }) => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  onModeChange?: (event: { mode: 'speaking' | 'listening' }) => void;
  onMessage?: (event: { message: string; source: 'user' | 'ai' }) => void;
}

export interface TripConversation {
  startSession: (config: unknown) => Promise<void>;
  endSession: () => Promise<void>;
  status: 'connecting' | 'connected' | 'disconnected';
  isSpeaking: boolean;
  setMicMuted: (muted: boolean) => void;
  sendUserMessage: (text: string) => void;
  sendContextualUpdate: (text: string) => void;
}

export function useTripConversation(options: TripConversationOptions): TripConversation {
  if (Platform.OS === 'web') {
    return {
      startSession: async () => {
        throw new Error(
          'ElevenLabs live conversation is not supported on web. Use an iOS or Android development build.'
        );
      },
      endSession: async () => undefined,
      status: 'disconnected',
      isSpeaking: false,
      setMicMuted: () => undefined,
      sendUserMessage: () => undefined,
      sendContextualUpdate: () => undefined,
    };
  }

  // Native-only import to avoid loading LiveKit/WebRTC in web bundles.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useConversation } = require('@elevenlabs/react-native') as {
    useConversation: (opts: TripConversationOptions) => TripConversation;
  };

  return useConversation(options);
}
