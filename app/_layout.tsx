import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TripProvider } from '../context/TripContext';
import { ElevenLabsAppProvider } from '../components/ElevenLabsAppProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TripProvider>
        <ElevenLabsAppProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#FFFFFF' },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="safety-setup" />
            <Stack.Screen name="route-selection" />
            <Stack.Screen name="active-trip" />
            <Stack.Screen name="trip-complete" />
          </Stack>
        </ElevenLabsAppProvider>
      </TripProvider>
    </SafeAreaProvider>
  );
}
