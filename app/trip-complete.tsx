import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../constants/colors';
import { deviationLevelLabel, formatDuration, type DeviationLevel } from '../services/api';

export default function TripCompleteScreen() {
  const router = useRouter();
  const {
    tripId,
    completedAt,
    actualDurationSeconds,
    actualDurationMinutes,
    finalDistanceFromRouteMeters,
    finalDeviationLevel,
    destination,
    routeName,
    wasEscalated,
  } = useLocalSearchParams<{
    tripId: string;
    completedAt: string;
    actualDurationSeconds: string;
    actualDurationMinutes: string;
    finalDistanceFromRouteMeters: string;
    finalDeviationLevel: DeviationLevel;
    destination: string;
    routeName: string;
    wasEscalated?: string;
  }>();

  const durationSec   = parseInt(actualDurationSeconds ?? '0', 10);
  const durationMin   = parseInt(actualDurationMinutes ?? '0', 10);
  const finalDistM    = parseInt(finalDistanceFromRouteMeters ?? '0', 10);
  const deviationLvl  = (finalDeviationLevel ?? 'none') as DeviationLevel;
  const isEscalated   = wasEscalated === 'true';

  const arrivedAt = completedAt
    ? new Date(completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ──────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>{isEscalated ? '🚨' : '🎉'}</Text>
          <Text style={styles.heroTitle}>
            {isEscalated ? 'Alert was raised' : 'You arrived safely!'}
          </Text>
          <Text style={styles.heroDestination}>{destination}</Text>
          {arrivedAt ? (
            <Text style={[styles.heroTime, isEscalated && styles.heroTimeAlert]}>
              {isEscalated ? 'Trip ended at' : 'Arrived at'} {arrivedAt}
            </Text>
          ) : null}
          {isEscalated ? (
            <Text style={styles.heroAlert}>
              Your trusted contact was notified with your location
            </Text>
          ) : null}
        </View>

        {/* ── Summary cards ─────────────────────────────────────────── */}
        <View style={styles.cards}>

          <View style={styles.card}>
            <Text style={styles.cardIcon}>⏱</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardLabel}>Trip Duration</Text>
              <Text style={styles.cardValue}>{formatDuration(durationSec)}</Text>
              <Text style={styles.cardSub}>{durationMin} min total</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardIcon}>📍</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardLabel}>Route Accuracy</Text>
              <Text style={styles.cardValue}>{deviationLevelLabel(deviationLvl)}</Text>
              <Text style={styles.cardSub}>
                Final deviation: {finalDistM}m from route
              </Text>
            </View>
          </View>

          {routeName ? (
            <View style={styles.card}>
              <Text style={styles.cardIcon}>🗺</Text>
              <View style={styles.cardBody}>
                <Text style={styles.cardLabel}>Route Taken</Text>
                <Text style={styles.cardValue}>{routeName}</Text>
              </View>
            </View>
          ) : null}

          <View style={[styles.card, styles.cardDebug]}>
            <Text style={styles.cardIcon}>🔑</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardLabel}>Trip ID (for testing)</Text>
              <Text style={styles.cardValueMono}>{tripId}</Text>
            </View>
          </View>

        </View>

        {/* ── Actions ───────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll:    { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 48 },

  hero: { alignItems: 'center', marginBottom: 40, gap: 8 },
  heroEmoji:       { fontSize: 72 },
  heroTitle:       { fontSize: 30, fontWeight: '800', color: colors.text, marginTop: 8 },
  heroDestination: { fontSize: 16, color: colors.textLight, textAlign: 'center', paddingHorizontal: 32 },
  heroTime:        { fontSize: 14, color: colors.green, fontWeight: '600' },
  heroTimeAlert:   { color: colors.red },
  heroAlert:       { fontSize: 14, color: colors.red, fontWeight: '600', textAlign: 'center', paddingHorizontal: 32, marginTop: 4 },

  cards: { gap: 12, marginBottom: 24 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardDebug:     { borderColor: colors.gray[200], backgroundColor: colors.gray[50] },
  cardIcon:      { fontSize: 28 },
  cardBody:      { flex: 1, gap: 2 },
  cardLabel:     { fontSize: 12, color: colors.textLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardValue:     { fontSize: 18, fontWeight: '700', color: colors.text },
  cardValueMono: { fontSize: 11, fontFamily: 'monospace', color: colors.gray[600], lineHeight: 18 },
  cardSub:       { fontSize: 12, color: colors.textLight, marginTop: 2 },

  homeButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  homeButtonText: { color: colors.white, fontSize: 17, fontWeight: '700' },
});
