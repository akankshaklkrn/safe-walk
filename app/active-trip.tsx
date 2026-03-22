import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  Alert, Modal, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../constants/colors';
import type { SafetyStatus, CommuteMode } from '../types';
import MapView from '../components/MapView';
import SafetyStatusIndicator from '../components/SafetyStatusIndicator';
import SOSButton from '../components/SOSButton';
import TripInfoBar from '../components/TripInfoBar';
import AICompanionPanel from '../components/AICompanionPanel';
import { getMockAIMessages } from '../data/mockMessages';
import {
  updateLocation,
  submitCheckResponse,
  getCurrentLocation,
  mapBackendStatus,
  formatEta,
  formatDistance,
  deviationLevelLabel,
  type DeviationLevel,
  type TripSummaryRaw,
} from '../services/api';

const POLL_INTERVAL_MS = 15_000;

export default function ActiveTripScreen() {
  const router = useRouter();
  const {
    tripId,
    destination,
    mode,
    etaMinutes,
    distanceMeters,
    startLat,
    startLng,
    routeName,
  } = useLocalSearchParams<{
    tripId: string;
    destination: string;
    mode: CommuteMode;
    etaMinutes: string;
    distanceMeters: string;
    startLat: string;
    startLng: string;
    routeName: string;
  }>();

  const [safetyStatus, setSafetyStatus]     = useState<SafetyStatus>('safe');
  const [checkInVisible, setCheckInVisible] = useState(false);
  const [escalated, setEscalated]           = useState(false);
  const [statusReason, setStatusReason]     = useState('');
  const [deviationLevel, setDeviationLevel] = useState<DeviationLevel>('none');
  const [rejoinedBanner, setRejoinedBanner] = useState(false);
  const aiMessages = getMockAIMessages();

  const escalatedRef = useRef(escalated);
  escalatedRef.current = escalated;

  const fallbackLoc = useRef({
    lat: parseFloat(startLat ?? '40.7128'),
    lng: parseFloat(startLng ?? '-74.0060'),
  });

  // ── Navigate to trip-complete screen ────────────────────────────────────
  const navigateToComplete = (summary: TripSummaryRaw) => {
    router.replace({
      pathname: '/trip-complete',
      params: {
        tripId:                       summary.tripId,
        completedAt:                  summary.completedAt,
        actualDurationSeconds:        String(summary.actualDurationSeconds),
        actualDurationMinutes:        String(summary.actualDurationMinutes),
        finalDistanceFromRouteMeters: String(summary.finalDistanceFromRouteMeters),
        finalDeviationLevel:          summary.finalDeviationLevel,
        destination:                  destination ?? '',
        routeName:                    routeName ?? '',
      },
    });
  };

  // ── Location polling ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!tripId) return;

    const sendUpdate = async () => {
      try {
        const loc = await getCurrentLocation();
        fallbackLoc.current = loc;

        const result = await updateLocation(tripId, loc.lat, loc.lng);

        // ── Milestone 7: trip complete ─────────────────────────────────────
        if (result.tripCompleted && result.summary) {
          navigateToComplete(result.summary);
          return; // stop processing this frame
        }

        setSafetyStatus(mapBackendStatus(result.status));
        setStatusReason(result.reason);
        setDeviationLevel(result.deviationLevel ?? 'none');

        // ── Milestone 6: back on track ────────────────────────────────────
        if (result.rejoinedRoute) {
          setRejoinedBanner(true);
          setTimeout(() => setRejoinedBanner(false), 3000);
        }

        // ── Risk state updates ────────────────────────────────────────────
        if (result.escalated && !escalatedRef.current) {
          setEscalated(true);
          setCheckInVisible(false);
        } else if (result.checkInRequired && !result.escalated) {
          setCheckInVisible(true);
        }

      } catch {
        // Silent fail — don't crash the screen on a missed poll
      }
    };

    // Don't poll immediately on mount — the user has just pressed Start Trip
    // and hasn't moved yet. GPS accuracy is also worst in the first few seconds.
    // The backend has a 60-second deviation grace period too, but delaying here
    // means the first check-in the user sees will always be meaningful.
    const interval = setInterval(sendUpdate, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [tripId]);

  // ── Check-in: user says they're okay ────────────────────────────────────
  const handleImOkay = async () => {
    if (!tripId) return;
    try {
      await submitCheckResponse(tripId, 'ok');
      setCheckInVisible(false);
      setSafetyStatus('safe');
      setStatusReason('');
    } catch {
      setCheckInVisible(false);
    }
  };

  // ── SOS button ───────────────────────────────────────────────────────────
  const handleSOS = async () => {
    if (!tripId) return;
    try {
      await submitCheckResponse(tripId, 'sos');
    } catch {
      // Update local state regardless
    }
    setSafetyStatus('risk');
    setEscalated(true);
    setCheckInVisible(false);
    Alert.alert(
      '🚨 SOS Activated',
      'Emergency alert sent to your trusted contact with your live location.',
      [{ text: 'OK' }],
    );
  };

  const etaLabel      = etaMinutes     ? formatEta(parseInt(etaMinutes, 10))          : '— min';
  const distanceLabel = distanceMeters ? formatDistance(parseInt(distanceMeters, 10)) : '— mi';

  return (
    <SafeAreaView style={[styles.container, escalated && styles.containerEscalated]}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <SafetyStatusIndicator status={safetyStatus} />
        <Text style={styles.modeIndicator}>
          {mode === 'walking' ? '🚶 Walking' : '🚗 Driving'}
          {routeName ? `  ·  ${routeName}` : ''}
        </Text>
        {statusReason ? (
          <Text style={styles.statusReason}>{statusReason}</Text>
        ) : null}
        {/* Deviation level badge — shows backend M5 output */}
        <View style={[styles.deviationBadge, deviationBadgeStyle(deviationLevel)]}>
          <Text style={styles.deviationBadgeText}>
            {deviationLevelLabel(deviationLevel)}
          </Text>
        </View>
      </View>

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <View style={styles.mapContainer}>
        <MapView />
      </View>

      {/* ── AI companion ─────────────────────────────────────────────────── */}
      <View style={styles.companionContainer}>
        <AICompanionPanel messages={aiMessages} />
      </View>

      {/* ── Trip info bar ─────────────────────────────────────────────────── */}
      <View style={styles.infoContainer}>
        <TripInfoBar eta={etaLabel} distance={distanceLabel} />
      </View>

      {/* ── SOS button ────────────────────────────────────────────────────── */}
      <View style={styles.sosContainer}>
        <SOSButton onPress={handleSOS} />
      </View>

      {/* ── Escalation banner ─────────────────────────────────────────────── */}
      {escalated && (
        <View style={styles.escalationBanner}>
          <Text style={styles.escalationText}>
            🚨 Alert sent to your trusted contact
          </Text>
        </View>
      )}

      {/* ── "Back on track" flash (Milestone 6) ───────────────────────────── */}
      {rejoinedBanner && (
        <View style={styles.rejoinBanner}>
          <Text style={styles.rejoinText}>✅ Back on route!</Text>
        </View>
      )}

      {/* ── Check-in modal ────────────────────────────────────────────────── */}
      <Modal visible={checkInVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>🤖</Text>
            <Text style={styles.modalTitle}>Are you okay?</Text>
            <Text style={styles.modalSubtitle}>
              SafeWalk noticed something unusual.{'\n'}Let us know you're safe.
            </Text>
            <TouchableOpacity style={styles.okayButton} onPress={handleImOkay}>
              <Text style={styles.okayButtonText}>I'm okay ✓</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sosModalButton} onPress={handleSOS}>
              <Text style={styles.sosModalButtonText}>Send SOS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// Returns inline style for the deviation badge background based on level
function deviationBadgeStyle(level: DeviationLevel) {
  switch (level) {
    case 'critical': return { backgroundColor: '#FEE2E2' }; // red-100
    case 'warning':  return { backgroundColor: '#FEF3C7' }; // yellow-100
    case 'minor':    return { backgroundColor: '#FEF9C3' }; // yellow-50
    default:         return { backgroundColor: '#D1FAE5' }; // green-100
  }
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: colors.background },
  containerEscalated: { backgroundColor: '#FFF5F5' },

  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  modeIndicator:  { fontSize: 13, color: colors.textLight, fontWeight: '600' },
  statusReason:   { fontSize: 12, color: colors.textLight, textAlign: 'center', fontStyle: 'italic' },

  deviationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 2,
  },
  deviationBadgeText: { fontSize: 12, fontWeight: '600', color: colors.text },

  mapContainer:       { height: 220, marginHorizontal: 24, marginBottom: 16 },
  companionContainer: { marginHorizontal: 24, marginBottom: 16 },
  infoContainer:      { paddingHorizontal: 24, marginBottom: 16 },
  sosContainer:       { alignItems: 'center', paddingBottom: 24 },

  escalationBanner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    backgroundColor: colors.red,
    paddingVertical: 10,
    alignItems: 'center',
  },
  escalationText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  rejoinBanner: {
    position: 'absolute',
    bottom: 120, left: 24, right: 24,
    backgroundColor: colors.green,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  rejoinText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  // Check-in modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  modalEmoji:        { fontSize: 48, marginBottom: 12 },
  modalTitle:        { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 8 },
  modalSubtitle:     { fontSize: 15, color: colors.textLight, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  okayButton: {
    width: '100%',
    backgroundColor: colors.green,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  okayButtonText:    { color: colors.white, fontSize: 17, fontWeight: '700' },
  sosModalButton: {
    width: '100%',
    backgroundColor: colors.red,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sosModalButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
