import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { colors } from '../constants/colors';
import { generateMockRouteSummary } from '../services/p3';
import RouteCard from '../components/RouteCard';
import type { Route, CommuteMode, RouteSummaryResponse } from '../types';
import { useTripContext } from '../context/TripContext';
import {
  fetchRoutes,
  startTrip,
  getCurrentLocation,
  type RouteOptionRaw,
} from '../services/api';

export default function RouteSelectionScreen() {
  const { destination, mode, safeWord } = useLocalSearchParams<{
    destination: string;
    mode: CommuteMode;
    safeWord: string;
  }>();
  const router = useRouter();
  const { tripSetupData } = useTripContext();

  // Routes are stored as display Route (for RouteCard) + raw RouteOptionRaw (for startTrip)
  const [routes, setRoutes]               = useState<Array<Route & { _raw: RouteOptionRaw }>>([]);
  const [selectedRoute, setSelectedRoute] = useState<(Route & { _raw: RouteOptionRaw }) | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [starting, setStarting]           = useState(false);
  const [routeSummary, setRouteSummary]   = useState<RouteSummaryResponse>(() =>
    generateMockRouteSummary({
      destination: destination || 'your destination',
      mode: mode ?? 'walking',
      routes: [],
    })
  );

  const routeSummaryUrl = Platform.OS === 'web'
    ? '/api/route-summary'
    : Constants.expoConfig?.hostUri
      ? `http://${Constants.expoConfig.hostUri}/api/route-summary`
      : null;

  const applyRouteSummary = async (nextRoutes: Array<Route & { _raw: RouteOptionRaw }>) => {
    const input = {
      destination: destination || 'your destination',
      mode: mode ?? 'walking',
      routes: nextRoutes,
    };

    const fallbackSummary = generateMockRouteSummary(input);

    if (!routeSummaryUrl) {
      setRoutes(nextRoutes.map((route) => ({
        ...route,
        observation:
          fallbackSummary.observations.find((item) => item.routeId === route.id)?.observation ??
          route.observation,
      })));
      setRouteSummary(fallbackSummary);
      return;
    }

    try {
      const response = await fetch(routeSummaryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error('Route summary request failed');
      }

      const summary = (await response.json()) as RouteSummaryResponse;
      const observationMap = new Map(
        summary.observations.map((item) => [item.routeId, item.observation])
      );

      setRoutes(nextRoutes.map((route) => ({
        ...route,
        observation: observationMap.get(route.id) ?? route.observation,
      })));
      setRouteSummary(summary);
    } catch {
      setRoutes(nextRoutes.map((route) => ({
        ...route,
        observation:
          fallbackSummary.observations.find((item) => item.routeId === route.id)?.observation ??
          route.observation,
      })));
      setRouteSummary(fallbackSummary);
    }
  };

  // Fetch real routes from backend on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const currentLocation = await getCurrentLocation();
        const result = await fetchRoutes(destination ?? '', mode ?? 'walking', currentLocation);
        if (!cancelled) {
          await applyRouteSummary(result);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message ?? 'Could not fetch routes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [destination, mode]);

  const handleStartTrip = async () => {
    if (!selectedRoute) return;
    const primaryContact = tripSetupData?.emergencyContacts.find((c) => c.isPrimary);
    if (!primaryContact) {
      setError('Please add a primary emergency contact in Safety Setup.');
      return;
    }

    setStarting(true);
    try {
      const currentLocation = await getCurrentLocation();
      const session = await startTrip({
        userId:         'user_001',
        destination:    destination ?? '',
        trustedContact: {
          name: primaryContact.name,
          phone: primaryContact.phoneNumber,
          email: primaryContact.email,
        },
        selectedRoute:  selectedRoute._raw,
        currentLocation,
      });

      // Navigate to active trip — pass session facts as string params
      router.push({
        pathname: '/active-trip',
        params: {
          tripId:          session.tripId,
          destination:     session.destination,
          mode:            session.mode,
          etaMinutes:      String(session.expectedEtaMinutes),
          distanceMeters:  String(selectedRoute._raw.distanceMeters),
          startLat:        String(session.startLocation.lat),
          startLng:        String(session.startLocation.lng),
          endLat:          String(selectedRoute._raw.endLocation.lat),
          endLng:          String(selectedRoute._raw.endLocation.lng),
          polyline:        selectedRoute._raw.polyline ?? '',
          routeName:       selectedRoute.name,
          safeWord:        safeWord ?? '',
          trustedContactEmail: session.trustedContact.email,
        },
      });
    } catch (e) {
      setError((e as Error).message ?? 'Failed to start trip');
      setStarting(false);
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
          <Text style={styles.comparisonText}>{routeSummary.overallComparison}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Loading state */}
        {loading && (
          <View style={styles.centeredState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.stateText}>Fetching routes from Google Maps…</Text>
          </View>
        )}

        {/* Error state */}
        {!loading && error && (
          <View style={styles.centeredState}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setError(null);
                setLoading(true);
                getCurrentLocation().then(loc =>
                  fetchRoutes(destination ?? '', mode ?? 'walking', loc)
                    .then(applyRouteSummary)
                    .catch(e => setError((e as Error).message))
                    .finally(() => setLoading(false))
                );
              }}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Route list */}
        {!loading && !error && routes.map((route) => (
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
          style={[
            styles.startButton,
            (!selectedRoute || starting) && styles.startButtonDisabled,
          ]}
          onPress={handleStartTrip}
          disabled={!selectedRoute || starting}
        >
          {starting
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.startButtonText}>Start Trip</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.background },
  header:          { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton:      { marginBottom: 12 },
  backText:        { fontSize: 16, color: colors.primary, fontWeight: '600' },
  headerContent:   { gap: 4 },
  title:           { fontSize: 28, fontWeight: 'bold', color: colors.text },
  destination:     { fontSize: 16, color: colors.textLight },
  modeIndicator:   { fontSize: 14, color: colors.primary, fontWeight: '600', marginTop: 4 },
  comparisonText:  { fontSize: 14, color: colors.textLight, lineHeight: 20, marginTop: 8 },
  scrollView:      { flex: 1 },
  scrollContent:   { padding: 24 },
  footer:          { padding: 24, paddingBottom: 32, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white },
  startButton:     { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 18, alignItems: 'center', shadowColor: colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  startButtonDisabled: { backgroundColor: colors.gray[300], shadowOpacity: 0, elevation: 0 },
  startButtonText: { color: colors.white, fontSize: 18, fontWeight: '600' },
  centeredState:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 16 },
  stateText:       { fontSize: 15, color: colors.textLight, textAlign: 'center' },
  errorIcon:       { fontSize: 40 },
  errorText:       { fontSize: 15, color: colors.red, textAlign: 'center', paddingHorizontal: 16 },
  retryButton:     { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 8 },
  retryText:       { color: colors.white, fontWeight: '600' },
});
