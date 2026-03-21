import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TripProvider } from '../context/TripContext';
import { ElevenLabsProvider } from '@elevenlabs/react-native';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TripProvider>
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
      </TripProvider>
      <ElevenLabsProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#FFFFFF' },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="route-selection" />
          <Stack.Screen name="active-trip" />
          <Stack.Screen name="trip-complete" />
        </Stack>
      </ElevenLabsProvider>
    </SafeAreaProvider>
  );
}
