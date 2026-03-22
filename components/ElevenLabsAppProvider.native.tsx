import { ReactNode } from 'react';

// @elevenlabs/react-native pulls in @livekit/react-native which requires native
// linking and a custom dev build — it cannot run inside Expo Go.
// This stub wraps children without any ElevenLabs context so the app loads
// normally in Expo Go. Voice features are no-ops until a dev build is used.
export function ElevenLabsAppProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
