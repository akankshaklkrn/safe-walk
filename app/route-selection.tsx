import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../constants/colors';
import { getMockRoutes } from '../data/mockRoutes';
import RouteCard from '../components/RouteCard';
import { Route, CommuteMode } from '../types';

export default function RouteSelectionScreen() {
  const { destination, mode } = useLocalSearchParams();
  const router = useRouter();
  const routes = getMockRoutes(destination as string, mode as CommuteMode);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);

  const handleStartTrip = () => {
    if (selectedRoute) {
      router.push({
        pathname: '/active-trip',
        params: {
          destination,
          mode,
          routeId: selectedRoute.id,
          routeName: selectedRoute.name,
        },
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Choose Your Route</Text>
          <Text style={styles.destination}>To: {destination}</Text>
          <Text style={styles.modeIndicator}>
            {mode === 'walking' ? '🚶 Walking' : '🚗 Driving'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {routes.map((route) => (
          <RouteCard
            key={route.id}
            route={route}
            isSelected={selectedRoute?.id === route.id}
            onSelect={() => setSelectedRoute(route)}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.startButton, !selectedRoute && styles.startButtonDisabled]}
          onPress={handleStartTrip}
          disabled={!selectedRoute}
        >
          <Text style={styles.startButtonText}>Start Trip</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginBottom: 12,
  },
  backText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerContent: {
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  destination: {
    fontSize: 16,
    color: colors.textLight,
  },
  modeIndicator: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  footer: {
    padding: 24,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  startButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  startButtonDisabled: {
    backgroundColor: colors.gray[300],
    shadowOpacity: 0,
    elevation: 0,
  },
  startButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
});
