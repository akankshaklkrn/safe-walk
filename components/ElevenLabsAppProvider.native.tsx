import { ReactNode } from 'react';
import { ElevenLabsProvider } from '@elevenlabs/react-native';

export function ElevenLabsAppProvider({ children }: { children: ReactNode }) {
  return <ElevenLabsProvider>{children}</ElevenLabsProvider>;
}
