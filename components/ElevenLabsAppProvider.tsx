import { ReactElement, ReactNode } from 'react';
import { Platform } from 'react-native';

export function ElevenLabsAppProvider({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') {
    return <>{children}</>;
  }

  // Native-only import to avoid loading LiveKit/WebRTC in web bundles.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ElevenLabsProvider } = require('@elevenlabs/react-native') as {
    ElevenLabsProvider: ({ children }: { children: ReactNode }) => ReactElement;
  };

  return <ElevenLabsProvider>{children}</ElevenLabsProvider>;
}
