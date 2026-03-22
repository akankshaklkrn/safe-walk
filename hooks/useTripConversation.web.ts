export interface TripConversationOptions {
  tokenFetchUrl?: string;
  onConnect?: (event: { conversationId: string }) => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  onModeChange?: (event: { mode: 'speaking' | 'listening' }) => void;
  onMessage?: (event: { message: string; source: 'user' | 'ai' }) => void;
}

export interface TripConversation {
  startSession: (_config: unknown) => Promise<void>;
  endSession: () => Promise<void>;
  status: 'connecting' | 'connected' | 'disconnected';
  isSpeaking: boolean;
  setMicMuted: (_muted: boolean) => void;
  sendUserMessage: (_text: string) => void;
  sendContextualUpdate: (_text: string) => void;
}

export function useTripConversation(_options: TripConversationOptions): TripConversation {
  return {
    startSession: async () => {
      throw new Error('ElevenLabs live conversation is not supported on web. Use an iOS or Android development build.');
    },
    endSession: async () => undefined,
    status: 'disconnected',
    isSpeaking: false,
    setMicMuted: () => undefined,
    sendUserMessage: () => undefined,
    sendContextualUpdate: () => undefined,
  };
}
