import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../constants/colors';
import { generateRouteSummary, generateMockRouteSummary } from '../services/p3';
import RouteCard from '../components/RouteCard';
import type { CheckInFrequency, Route, CommuteMode, RouteSummaryResponse } from '../types';
import { useTripContext } from '../context/TripContext';
import {
  fetchRoutes,
  startTrip,
  getCurrentLocation,
  type RouteOptionRaw,
} from '../services/api';

export default function RouteSelectionScreen() {
  const { destination, mode, safeWord, checkInFrequency, isSilentMode, routeDeviationAlerts } = useLocalSearchParams<{
    destination: string;
    mode: CommuteMode;
    safeWord: string;
    checkInFrequency: CheckInFrequency;
    isSilentMode: string;
    routeDeviationAlerts: string;
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

  const applyRouteSummary = async (nextRoutes: Array<Route & { _raw: RouteOptionRaw }>) => {
    const input = {
      destination: destination || 'your destination',
      mode: mode ?? 'walking',
      routes: nextRoutes,
    };

    const summary = await generateRouteSummary(input);
    const observationMap = new Map(
      summary.observations.map((item) => [item.routeId, item.observation])
    );

    setRoutes(nextRoutes.map((route) => ({
      ...route,
      observation: observationMap.get(route.id) ?? route.observation,
    })));
    setRouteSummary(summary);
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
          checkInFrequency: checkInFrequency ?? tripSetupData?.checkInFrequency ?? 'smart',
          isSilentMode:    isSilentMode ?? String(tripSetupData?.isSilentMode ?? false),
          routeDeviationAlerts: routeDeviationAlerts ?? String(tripSetupData?.routeDeviationAlerts ?? true),
          originLabel: tripSetupData?.currentLocation?.address ?? '',
          trustedContactEmail: session.trustedContact.email,
        },
      });
    } catch (e) {
      setError((e as Error).message ?? 'Failed to start trip');
      setStarting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Select Route</Text>
        <View style={styles.appBarRight}>
          <TouchableOpacity style={styles.iconButton}>
            <Text style={styles.iconText}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Text style={styles.iconText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Header Section */}
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>Choose Your Route</Text>
        <Text style={styles.headerDestination}>To: {destination}</Text>
        <View style={styles.contextRow}>
          <Text style={styles.contextMode}>
            {mode === 'walking' ? '🚶 Walking' : '🚗 Driving'}
          </Text>
          <Text style={styles.contextDivider}>•</Text>
          <Text style={styles.contextAI}>AI companion is ready to join you.</Text>
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

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        <Text style={styles.helperText}>
          {routeSummary.overallComparison || 'Select a route to see details and start your trip.'}
        </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.background },

  // App Bar
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  backButton: {
    width: 80,
    alignItems: 'flex-start',
  },
  backIcon: {
    fontSize: 24,
    color: '#1A1A1A',
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  appBarRight: {
    flexDirection: 'row',
    gap: 12,
    width: 80,
    justifyContent: 'flex-end',
  },
  iconButton: {
    padding: 6,
    borderRadius: 8,
  },
  iconText: {
    fontSize: 22,
  },

  // Header Section
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    lineHeight: 30,
  },
  headerDestination: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 14,
    lineHeight: 20,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contextMode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  contextDivider: {
    fontSize: 14,
    color: '#D1D5DB',
    marginHorizontal: 2,
  },
  contextAI: {
    fontSize: 14,
    color: '#9CA3AF',
  },

  // Legacy styles (kept for compatibility)
  header:          { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  backText:        { fontSize: 16, color: colors.primary, fontWeight: '600' },
  headerContent:   { gap: 4 },
  title:           { fontSize: 28, fontWeight: 'bold', color: colors.text },
  destination:     { fontSize: 16, color: colors.textLight },
  modeIndicator:   { fontSize: 14, color: colors.primary, fontWeight: '600', marginTop: 4 },
  comparisonText:  { fontSize: 14, color: colors.textLight, lineHeight: 20, marginTop: 8 },
  scrollView:      { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent:   { padding: 20, paddingTop: 24 },

  // Bottom Section
  bottomSection: {
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  helperText: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 20,
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  startButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonDisabled: {
    backgroundColor: '#D1D5DB',
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Legacy footer styles
  footer:          { padding: 24, paddingBottom: 32, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white },
  centeredState:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 16 },
  stateText:       { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  errorIcon:       { fontSize: 40, marginBottom: 4 },
  errorText:       { fontSize: 15, color: colors.red, textAlign: 'center', paddingHorizontal: 20, lineHeight: 22 },
  retryButton:     { marginTop: 12, paddingHorizontal: 28, paddingVertical: 14, backgroundColor: colors.primary, borderRadius: 10 },
  retryText:       { color: colors.white, fontWeight: '700', fontSize: 15 },
});
