import { useConversation } from '@elevenlabs/react-native';

export type TripConversationOptions = Parameters<typeof useConversation>[0];
export type TripConversation = ReturnType<typeof useConversation>;

export function useTripConversation(options: TripConversationOptions): TripConversation {
  return useConversation(options);
}
