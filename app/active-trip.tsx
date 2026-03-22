import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { colors } from '../constants/colors';
import type { SafetyStatus, CommuteMode } from '../types';
import MapView from '../components/MapView';
import SafetyStatusIndicator from '../components/SafetyStatusIndicator';
import SOSButton from '../components/SOSButton';
import TripInfoBar from '../components/TripInfoBar';
import AICompanionPanel from '../components/AICompanionPanel';
import CheckInModal from '../components/CheckInModal';
import EscalationAlert from '../components/EscalationAlert';
import { getMockAIMessages, type AIMessage } from '../data/mockMessages';
import { useTripConversation } from '../hooks/useTripConversation';
import { containsSafeWord } from '../services/p3';
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
    safeWord,
  } = useLocalSearchParams<{
    tripId: string;
    destination: string;
    mode: CommuteMode;
    etaMinutes: string;
    distanceMeters: string;
    startLat: string;
    startLng: string;
    routeName: string;
    safeWord: string;
  }>();

  // ── Backend/risk state (P2) ──────────────────────────────────────────────
  const [safetyStatus, setSafetyStatus]     = useState<SafetyStatus>('safe');
  const [escalated, setEscalated]           = useState(false);
  const [statusReason, setStatusReason]     = useState('');
  const [deviationLevel, setDeviationLevel] = useState<DeviationLevel>('none');
  const [rejoinedBanner, setRejoinedBanner] = useState(false);

  // ── Voice/UI state (P3) ──────────────────────────────────────────────────
  const [showCheckIn, setShowCheckIn]       = useState(false);
  const [showEscalation, setShowEscalation] = useState(false);
  const [draftMessage, setDraftMessage]     = useState('');
  const [voiceStatus, setVoiceStatus]       = useState('Connecting trip companion');
  const [isMicMuted, setIsMicMuted]         = useState(false);
  const [aiMessages, setAiMessages]         = useState<AIMessage[]>(() =>
    getMockAIMessages(
      (destination as string) || 'your destination',
      (routeName as string) || 'your selected route',
      'safe',
    )
  );

  const escalatedRef        = useRef(escalated);
  escalatedRef.current      = escalated;
  const hasStartedSessionRef = useRef(false);
  const fallbackLoc          = useRef({
    lat: parseFloat(startLat ?? '40.7128'),
    lng: parseFloat(startLng ?? '-74.0060'),
  });

  // ── P3 config ────────────────────────────────────────────────────────────
  const configuredSafeWord = typeof safeWord === 'string' ? safeWord : '';
  const destinationName    = (destination as string) || 'your destination';
  const selectedRouteName  = (routeName as string) || 'your selected route';
  const agentId            = process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_ID;
  const useServerToken     = process.env.EXPO_PUBLIC_ELEVENLABS_USE_SERVER_TOKEN === 'true';
  const apiBaseUrl         = Constants.expoConfig?.hostUri
    ? `http://${Constants.expoConfig.hostUri}` : '';
  const tokenFetchUrl      = useServerToken && apiBaseUrl
    ? `${apiBaseUrl}/api/elevenlabs-token` : undefined;

  const appendMessage = (message: AIMessage) => {
    setAiMessages((prev) => [...prev, message]);
  };

  // ── ElevenLabs conversation hook (P3) ───────────────────────────────────
  const conversation = useTripConversation({
    tokenFetchUrl,
    onConnect: ({ conversationId }) => {
      setVoiceStatus(`Companion connected: ${conversationId}`);
    },
    onDisconnect: () => {
      setVoiceStatus('Companion disconnected');
    },
    onError: (error) => {
      const msg = typeof error === 'string' ? error : 'Conversation failed';
      setVoiceStatus(msg);
    },
    onModeChange: ({ mode: m }) => {
      setVoiceStatus(m === 'speaking' ? 'AI companion speaking' : 'Listening');
    },
    onMessage: ({ message, source }) => {
      appendMessage({
        id: `${Date.now()}-${source}`,
        text: message,
        timestamp: new Date(),
        sender: source === 'user' ? 'user' : 'ai',
      });
      if (source === 'user' && configuredSafeWord && containsSafeWord(message, configuredSafeWord)) {
        void handleEscalation('Safe word detected in live conversation');
      }
    },
  });

  // ── Escalation handler — ends voice, alerts contact (P3) ────────────────
  // Defined before polling useEffect so the closure can reference it.
  const handleEscalation = async (reason: string) => {
    setShowCheckIn(false);
    setShowEscalation(false);
    setEscalated(true);
    setSafetyStatus('risk');

    if (conversation.status !== 'disconnected') {
      await conversation.endSession();
    }

    appendMessage({
      id: `${Date.now()}-escalation`,
      text: `Emergency protocol activated. Reason: ${reason}. Your trusted contact has been notified with your live location and trip details.`,
      timestamp: new Date(),
      sender: 'ai',
    });

    Alert.alert(
      'Escalation Triggered',
      `Emergency alert sent to your trusted contact with your live location. Reason: ${reason}.`,
      [{ text: 'OK' }],
    );
  };

  // ── Navigate to trip-complete screen (P2) ───────────────────────────────
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

  // ── Backend location polling (P2) ───────────────────────────────────────
  useEffect(() => {
    if (!tripId) return;

    const sendUpdate = async () => {
      try {
        const loc = await getCurrentLocation();
        fallbackLoc.current = loc;

        const result = await updateLocation(tripId, loc.lat, loc.lng);

        if (result.tripCompleted && result.summary) {
          navigateToComplete(result.summary);
          return;
        }

        setSafetyStatus(mapBackendStatus(result.status));
        setStatusReason(result.reason);
        setDeviationLevel(result.deviationLevel ?? 'none');

        if (result.rejoinedRoute) {
          setRejoinedBanner(true);
          setTimeout(() => setRejoinedBanner(false), 3000);
        }

        if (result.escalated && !escalatedRef.current) {
          void handleEscalation('Trip status escalated by backend');
        } else if (result.checkInRequired && !result.escalated) {
          setShowCheckIn(true);
        }
      } catch {
        // Silent fail — don't crash the screen on a missed poll
      }
    };

    // First poll after one interval — user has just pressed Start Trip and
    // hasn't moved yet. Backend also has a 60s deviation grace period.
    const interval = setInterval(sendUpdate, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [tripId]);

  // ── Voice session start (P3) ─────────────────────────────────────────────
  useEffect(() => {
    if (hasStartedSessionRef.current || safetyStatus === 'risk') return;
    if (!agentId) {
      setVoiceStatus('Missing EXPO_PUBLIC_ELEVENLABS_AGENT_ID');
      return;
    }

    hasStartedSessionRef.current = true;
    conversation
      .startSession({
        agentId,
        tokenFetchUrl,
        userId: `trip-${Date.now()}`,
        dynamicVariables: {
          destination: destinationName,
          route_name: selectedRouteName,
          safe_word_enabled: Boolean(configuredSafeWord),
        },
      })
      .then(() => {
        conversation.sendContextualUpdate(
          `SafeWalk trip started. Destination: ${destinationName}. Route: ${selectedRouteName}. Keep the user company for the full trip.`
        );
      })
      .catch((error) => {
        const msg = error instanceof Error ? error.message : 'Could not start conversation';
        setVoiceStatus(msg);
      });
  }, [agentId, configuredSafeWord, conversation, destinationName, safetyStatus, selectedRouteName, tokenFetchUrl]);

  // ── Voice cleanup on unmount (P3) ────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (conversation.status !== 'disconnected') {
        conversation.endSession().catch(() => undefined);
      }
    };
  }, [conversation]);

  // ── Voice status label sync (P3) ─────────────────────────────────────────
  useEffect(() => {
    if (conversation.status === 'connected') {
      setVoiceStatus(isMicMuted ? 'Mic muted' : conversation.isSpeaking ? 'AI companion speaking' : 'Listening');
    } else if (conversation.status === 'connecting') {
      setVoiceStatus('Connecting trip companion');
    } else if (conversation.status === 'disconnected' && safetyStatus !== 'risk') {
      setVoiceStatus('Trip companion offline');
    }
  }, [conversation.isSpeaking, conversation.status, isMicMuted, safetyStatus]);

  // ── Check-in response (P3) ───────────────────────────────────────────────
  const handleCheckInResponse = async (isOkay: boolean) => {
    setShowCheckIn(false);
    if (isOkay) {
      if (tripId) {
        try { await submitCheckResponse(tripId, 'ok'); } catch {}
      }
      setSafetyStatus('safe');
      setStatusReason('');
      appendMessage({
        id: `${Date.now()}-checkin-safe`,
        text: "Great! Glad you're doing well. I'll stay with you for the rest of the trip.",
        timestamp: new Date(),
        sender: 'ai',
      });
      return;
    }
    setSafetyStatus('uncertain');
    appendMessage({
      id: `${Date.now()}-checkin-help`,
      text: "I'm here to help. Stay with me, and use SOS if you need immediate support.",
      timestamp: new Date(),
      sender: 'ai',
    });
  };

  const handleConfirmSafe = () => {
    setShowEscalation(false);
    setSafetyStatus('safe');
    appendMessage({
      id: `${Date.now()}-confirm-safe`,
      text: "Glad to hear you're safe. I'll continue monitoring the trip.",
      timestamp: new Date(),
      sender: 'ai',
    });
  };

  const handleEmergencyContact = () => {
    void handleEscalation('Emergency contact requested from safety alert');
  };

  const handleSOS = () => {
    if (tripId) {
      submitCheckResponse(tripId, 'sos').catch(() => {});
    }
    void handleEscalation('Manual SOS');
  };

  const handleEndTrip = async () => {
    if (conversation.status !== 'disconnected') {
      await conversation.endSession();
    }
    router.replace('/');
  };

  const handleMicToggle = () => {
    if (conversation.status !== 'connected') {
      Alert.alert('Voice Offline', 'The trip companion is not connected yet.');
      return;
    }
    const nextMuted = !isMicMuted;
    conversation.setMicMuted(nextMuted);
    setIsMicMuted(nextMuted);
  };

  const handleSendMessage = () => {
    if (!draftMessage.trim()) return;
    if (configuredSafeWord && containsSafeWord(draftMessage, configuredSafeWord)) {
      setDraftMessage('');
      void handleEscalation('Safe word detected in manual message');
      return;
    }
    if (conversation.status === 'connected') {
      conversation.sendUserMessage(draftMessage.trim());
      setDraftMessage('');
      return;
    }
    Alert.alert('Voice Offline', 'The live companion is not connected yet.');
  };

  const isConnected  = conversation.status === 'connected';
  const isConnecting = conversation.status === 'connecting';
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

      {/* ── Voice companion panel (P3) ───────────────────────────────────── */}
      <View style={styles.voiceContainer}>
        <Text style={styles.inputLabel}>Trip Companion</Text>
        <Text style={styles.voiceStatus}>{voiceStatus}</Text>
        <View style={styles.voiceButtonRow}>
          <TouchableOpacity
            style={[styles.voiceControlButton, !isConnected && styles.voiceControlButtonDisabled]}
            onPress={handleMicToggle}
            disabled={!isConnected}
          >
            <Text style={styles.voiceControlText}>Mute / Unmute Mic</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.voiceActionButton, isConnecting && styles.voiceControlButtonDisabled]}
            onPress={() => void handleEndTrip()}
            disabled={isConnecting}
          >
            <Text style={styles.voiceActionButtonText}>End Trip</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.messageInput}
          placeholder="Optional manual message to the companion"
          placeholderTextColor={colors.textLight}
          value={draftMessage}
          onChangeText={setDraftMessage}
          autoCapitalize="sentences"
          autoCorrect={false}
        />

        <View style={styles.monitorRow}>
          <Text style={styles.monitorText}>
            {configuredSafeWord
              ? 'Safe word armed during the full live conversation.'
              : 'No safe word configured.'}
          </Text>
          <TouchableOpacity
            style={[styles.sendButton, !isConnected && styles.voiceControlButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!isConnected}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Trip info bar ─────────────────────────────────────────────────── */}
      <View style={styles.infoContainer}>
        <TripInfoBar eta={etaLabel} distance={distanceLabel} />
      </View>

      {/* ── SOS button ────────────────────────────────────────────────────── */}
      <View style={styles.sosContainer}>
        <SOSButton onPress={handleSOS} />
      </View>

      {/* ── Escalation banner (P2) ────────────────────────────────────────── */}
      {escalated && (
        <View style={styles.escalationBanner}>
          <Text style={styles.escalationText}>🚨 Alert sent to your trusted contact</Text>
        </View>
      )}

      {/* ── "Back on track" flash (P2, Milestone 6) ──────────────────────── */}
      {rejoinedBanner && (
        <View style={styles.rejoinBanner}>
          <Text style={styles.rejoinText}>✅ Back on route!</Text>
        </View>
      )}

      {/* ── Check-in modal component (P3) ────────────────────────────────── */}
      <CheckInModal visible={showCheckIn} onRespond={handleCheckInResponse} />

      {/* ── Escalation alert component (P3) ──────────────────────────────── */}
      <EscalationAlert
        visible={showEscalation}
        onConfirmSafe={handleConfirmSafe}
        onEmergencyContact={handleEmergencyContact}
      />
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

  mapContainer:       { height: 250, marginHorizontal: 24, marginBottom: 16 },
  companionContainer: { marginHorizontal: 24, marginBottom: 12 },

  // Voice companion panel (P3)
  voiceContainer: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputLabel:             { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 },
  voiceStatus:            { fontSize: 13, color: colors.textLight, lineHeight: 18, marginBottom: 12 },
  voiceButtonRow:         { flexDirection: 'row', gap: 12, marginBottom: 12 },
  voiceControlButton:     { backgroundColor: colors.primary, borderRadius: 12, flex: 1, paddingVertical: 14, alignItems: 'center' },
  voiceActionButton:      { backgroundColor: colors.gray[700], borderRadius: 12, flex: 1, paddingVertical: 14, alignItems: 'center' },
  voiceControlButtonDisabled: { opacity: 0.7 },
  voiceControlText:       { color: colors.white, fontSize: 15, fontWeight: '700' },
  voiceActionButtonText:  { color: colors.white, fontSize: 15, fontWeight: '700' },
  messageInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.gray[50],
  },
  monitorRow:   { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  monitorText:  { flex: 1, fontSize: 13, color: colors.textLight, lineHeight: 18 },
  sendButton:   { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  sendButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' },

  infoContainer: { paddingHorizontal: 24, marginBottom: 16 },
  sosContainer:  { alignItems: 'center', paddingBottom: 24 },

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
