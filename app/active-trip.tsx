import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Audio } from 'expo-av';
import { colors } from '../constants/colors';
import type { SafetyStatus, CommuteMode } from '../types';
import MapView from '../components/MapView';
import SafetyStatusIndicator from '../components/SafetyStatusIndicator';
import SOSButton from '../components/SOSButton';
import TripInfoBar from '../components/TripInfoBar';
import AICompanionPanel from '../components/AICompanionPanel';
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
    endLat,
    endLng,
    polyline,
    routeName,
    safeWord,
    trustedContactEmail,
  } = useLocalSearchParams<{
    tripId: string;
    destination: string;
    mode: CommuteMode;
    etaMinutes: string;
    distanceMeters: string;
    startLat: string;
    startLng: string;
    endLat: string;
    endLng: string;
    polyline: string;
    routeName: string;
    safeWord: string;
    trustedContactEmail: string;
  }>();

  const [safetyStatus, setSafetyStatus] = useState<SafetyStatus>('safe');
  const [escalated, setEscalated] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [deviationLevel, setDeviationLevel] = useState<DeviationLevel>('none');
  const [rejoinedBanner, setRejoinedBanner] = useState(false);

  const [showSOSConfirmation, setShowSOSConfirmation] = useState(false);
  const [pendingEscalationReason, setPendingEscalationReason] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('Connecting trip companion');
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>(() =>
    getMockAIMessages(
      destination || 'your destination',
      routeName || 'your selected route',
      'safe'
    )
  );
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(
    startLat && startLng
      ? { lat: parseFloat(startLat), lng: parseFloat(startLng) }
      : null
  );

  const escalatedRef = useRef(escalated);
  const hasStartedSessionRef = useRef(false);
  const countdownActiveRef = useRef(false);
  const tripStartTimeRef = useRef(Date.now());
  const fallbackLoc = useRef({
    lat: parseFloat(startLat ?? '40.7128'),
    lng: parseFloat(startLng ?? '-74.0060'),
  });

  escalatedRef.current = escalated;

  const configuredSafeWord = typeof safeWord === 'string' ? safeWord : '';
  const destinationName = destination || 'your destination';
  const selectedRouteName = routeName || 'your selected route';
  const agentId = process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_ID;
  const useServerToken = process.env.EXPO_PUBLIC_ELEVENLABS_USE_SERVER_TOKEN === 'true';
  const apiBaseUrl = Constants.expoConfig?.hostUri
    ? `http://${Constants.expoConfig.hostUri}`
    : '';
  const tokenFetchUrl =
    useServerToken && apiBaseUrl ? `${apiBaseUrl}/api/elevenlabs-token` : undefined;
  const emailAlertBaseUrl = process.env.EXPO_PUBLIC_API_URL
    ? process.env.EXPO_PUBLIC_API_URL
    : Constants.expoConfig?.hostUri
      ? `http://${Constants.expoConfig.hostUri.split(':')[0]}:3000`
      : 'http://localhost:3000';

  const appendMessage = (message: AIMessage) => {
    setAiMessages((prev) => [...prev, message]);
  };

  const sendEmailAlert = async (alertType: string, message: string) => {
    const activeLocation = currentLocation ?? fallbackLoc.current;
    const payload = {
      userId: `trip-${tripId || 'unknown'}`,
      tripId: tripId || 'unknown-trip',
      location: activeLocation,
      timestamp: new Date().toISOString(),
      alertType,
      message,
      mode: (mode === 'car' ? 'car' : 'walking') as CommuteMode,
      trustedContactEmail: trustedContactEmail || undefined,
    };

    const response = await fetch(`${emailAlertBaseUrl}/alerts/sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as {
      ok?: boolean;
      channel?: string;
      alertId?: string;
      error?: string;
    };

    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Failed to send email alert.');
    }

    appendMessage({
      id: `${Date.now()}-email-sent`,
      text: `Email alert sent (${result.channel || 'email'}). Alert ID: ${result.alertId || 'n/a'}.`,
      timestamp: new Date(),
      sender: 'ai',
    });
  };

  const triggerCountdownEscalation = (reason: string) => {
    if (escalatedRef.current || countdownActiveRef.current) {
      return;
    }

    countdownActiveRef.current = true;
    setPendingEscalationReason(reason);
    setSafetyStatus('uncertain');
  };

  const conversation = useTripConversation({
    tokenFetchUrl,
    onConnect: ({ conversationId }: { conversationId: string }) => {
      setVoiceStatus(`Companion connected: ${conversationId}`);
    },
    onDisconnect: () => {
      setVoiceStatus('Companion disconnected');
    },
    onError: (error: string) => {
      setVoiceStatus(error || 'Conversation failed');
    },
    onModeChange: ({ mode: conversationMode }: { mode: 'speaking' | 'listening' }) => {
      setVoiceStatus(conversationMode === 'speaking' ? 'AI companion speaking' : 'Listening');
    },
    onMessage: ({
      message,
      source,
    }: {
      message: string;
      source: 'user' | 'ai';
    }) => {
      appendMessage({
        id: `${Date.now()}-${source}`,
        text: message,
        timestamp: new Date(),
        sender: source === 'user' ? 'user' : 'ai',
      });

      if (source === 'user' && configuredSafeWord && containsSafeWord(message, configuredSafeWord)) {
        void handleEscalation('Safe word detected in live conversation');
      }

      if (source === 'ai' && configuredSafeWord && containsSafeWord(message, 'escalating now')) {
        triggerCountdownEscalation('User did not respond for a while');
      }
    },
  });
  const navigateToComplete = (summary: TripSummaryRaw) => {
    router.replace({
      pathname: '/trip-complete',
      params: {
        tripId: summary.tripId,
        completedAt: summary.completedAt,
        actualDurationSeconds: String(summary.actualDurationSeconds),
        actualDurationMinutes: String(summary.actualDurationMinutes),
        finalDistanceFromRouteMeters: String(summary.finalDistanceFromRouteMeters),
        finalDeviationLevel: summary.finalDeviationLevel,
        destination: destination ?? '',
        routeName: routeName ?? '',
      },
    });
  };

  const handleEscalation = async (reason: string, alertType = 'critical') => {
    countdownActiveRef.current = false;
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
    try {
      await sendEmailAlert(alertType, reason);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Could not send email alert.';
      appendMessage({
        id: `${Date.now()}-email-failed`,
        text: `Email alert failed: ${errorMessage}`,
        timestamp: new Date(),
        sender: 'ai',
      });
    }

  };

  useEffect(() => {
    Audio.requestPermissionsAsync()
      .then(({ granted }) => {
        setMicPermissionGranted(granted);
        if (!granted) {
          setVoiceStatus('Microphone permission is required for live conversation');
        }
      })
      .catch(() => {
        setMicPermissionGranted(false);
        setVoiceStatus('Could not request microphone permission');
      });
  }, []);


  useEffect(() => {
    if (!tripId) {
      return;
    }

    const sendUpdate = async () => {
      try {
        const loc = await getCurrentLocation();
        fallbackLoc.current = loc;
        setCurrentLocation(loc);

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
          triggerCountdownEscalation(result.reason || 'Late response detected');
        }
      } catch {
        // Silent fail so the screen survives a missed poll.
      }
    };

    const interval = setInterval(sendUpdate, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [tripId]);

  useEffect(() => {
    if (hasStartedSessionRef.current || safetyStatus === 'risk' || micPermissionGranted !== true) {
      return;
    }

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
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Could not start conversation';
        setVoiceStatus(message);
      });
  }, [
    agentId,
    configuredSafeWord,
    conversation,
    destinationName,
    safetyStatus,
    selectedRouteName,
    tokenFetchUrl,
    micPermissionGranted,
  ]);

  useEffect(() => {
    return () => {
      if (conversation.status !== 'disconnected') {
        conversation.endSession().catch(() => undefined);
      }
    };
  }, [conversation]);

  useEffect(() => {
    if (conversation.status === 'connected') {
      setVoiceStatus(
        isMicMuted
          ? 'Mic muted'
          : conversation.isSpeaking
            ? 'AI companion speaking'
            : 'Listening'
      );
    } else if (conversation.status === 'connecting') {
      setVoiceStatus('Connecting trip companion');
    } else if (conversation.status === 'disconnected' && safetyStatus !== 'risk') {
      setVoiceStatus('Trip companion offline');
    }
  }, [conversation.isSpeaking, conversation.status, isMicMuted, safetyStatus]);

  const handleConfirmSafe = async () => {
    countdownActiveRef.current = false;
    setSafetyStatus('safe');
    setPendingEscalationReason('');

    if (tripId) {
      try {
        await submitCheckResponse(tripId, 'ok');
      } catch { }
    }

    appendMessage({
      id: `${Date.now()}-confirm-safe`,
      text: "Glad to hear you're safe. I'll continue monitoring the trip.",
      timestamp: new Date(),
      sender: 'ai',
    });
  };

  const handleEmergencyContact = () => {
    void handleEscalation(
      pendingEscalationReason || 'Emergency contact requested from safety alert',
      'late-response'
    );
  };

  const handleSOS = () => {
    void handleEscalation('Manual SOS triggered');
    setShowSOSConfirmation(true);

    // Fire backend + email calls in the background after UI has already responded
    const activeLocation = currentLocation ?? fallbackLoc.current;

    if (tripId) {
      submitCheckResponse(tripId, 'sos').catch(() => undefined);
    }

  };

  const handleEndTrip = async () => {
    Alert.alert(
      'End Trip',
      'Are you sure you want to end this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Trip',
          style: 'destructive',
          onPress: async () => {
            if (conversation.status !== 'disconnected') {
              await conversation.endSession();
            }
            const durationSeconds = Math.floor((Date.now() - tripStartTimeRef.current) / 1000);
            const durationMinutes = Math.floor(durationSeconds / 60);
            router.replace({
              pathname: '/trip-complete',
              params: {
                tripId:                       tripId ?? 'unknown',
                completedAt:                  new Date().toISOString(),
                actualDurationSeconds:        String(durationSeconds),
                actualDurationMinutes:        String(durationMinutes),
                finalDistanceFromRouteMeters: '0',
                finalDeviationLevel:          deviationLevel ?? 'none',
                destination:                  destination ?? '',
                routeName:                    routeName ?? '',
                wasEscalated:                 String(escalated),
              },
            });
          },
        },
      ],
    );
  };

  const handleMicToggle = () => {
    if (micPermissionGranted !== true) {
      Alert.alert('Microphone Required', 'Please allow microphone access to use the live companion.');
      return;
    }

    if (conversation.status !== 'connected') {
      Alert.alert('Voice Offline', 'The trip companion is not connected yet.');
      return;
    }

    const nextMuted = !isMicMuted;
    conversation.setMicMuted(nextMuted);
    setIsMicMuted(nextMuted);
  };

  const handleSendMessage = () => {
    if (!draftMessage.trim()) {
      return;
    }

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

  const handleRequestMicPermission = async () => {
    const { granted } = await Audio.requestPermissionsAsync();
    setMicPermissionGranted(granted);
    setVoiceStatus(granted ? 'Microphone permission granted' : 'Microphone permission denied');
  };

  const isConnected = conversation.status === 'connected';
  const isConnecting = conversation.status === 'connecting';
  const etaLabel = etaMinutes ? formatEta(parseInt(etaMinutes, 10)) : '— min';
  const distanceLabel = distanceMeters ? formatDistance(parseInt(distanceMeters, 10)) : '— mi';

  return (
    <SafeAreaView style={[styles.container, escalated && styles.containerEscalated]}>

      {/* ── Compact header: status + SOS ──────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <SafetyStatusIndicator status={safetyStatus} />
          {statusReason ? (
            <Text style={styles.statusReason} numberOfLines={1}>{statusReason}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.sosButton}
          activeOpacity={0.8}
          onPress={() => void handleSOS()}
        >
          <Text style={styles.sosButtonLabel}>SOS</Text>
          <Text style={styles.sosButtonSub}>Emergency</Text>
        </TouchableOpacity>
      </View>

      {/* ── Scrollable content ────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Map */}
        <View style={styles.mapContainer}>
          <MapView
            userLocation={currentLocation}
            destination={
              endLat && endLng
                ? { lat: parseFloat(endLat), lng: parseFloat(endLng) }
                : null
            }
            routePolyline={typeof polyline === 'string' ? polyline : ''}
            safetyStatus={safetyStatus}
          />
        </View>

        {/* ETA + Distance inline below map */}
        <View style={styles.etaRow}>
          <View style={styles.etaChip}>
            <Text style={styles.etaChipIcon}>⏱</Text>
            <Text style={styles.etaChipLabel}>ETA</Text>
            <Text style={styles.etaChipValue}>{etaLabel}</Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaChip}>
            <Text style={styles.etaChipIcon}>📍</Text>
            <Text style={styles.etaChipLabel}>Distance</Text>
            <Text style={styles.etaChipValue}>{distanceLabel}</Text>
          </View>
        </View>

        {/* AI Companion */}
        <View style={styles.companionContainer}>
          <AICompanionPanel messages={aiMessages} />
        </View>

        {/* Voice / controls */}
        <View style={styles.voiceContainer}>
          <Text style={styles.inputLabel}>Trip Companion</Text>
          <Text style={styles.voiceStatus}>{voiceStatus}</Text>
          {micPermissionGranted !== true && (
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={() => void handleRequestMicPermission()}
            >
              <Text style={styles.permissionButtonText}>Enable Microphone</Text>
            </TouchableOpacity>
          )}
          <View style={styles.voiceButtonRow}>
            <TouchableOpacity
              style={[
                styles.voiceControlButton,
                (!isConnected || micPermissionGranted !== true) && styles.voiceControlButtonDisabled,
              ]}
              onPress={handleMicToggle}
              disabled={!isConnected || micPermissionGranted !== true}
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
            placeholder="Message your companion…"
            placeholderTextColor={colors.textLight}
            value={draftMessage}
            onChangeText={setDraftMessage}
            autoCapitalize="sentences"
            autoCorrect={false}
          />

          <View style={styles.monitorRow}>
            <Text style={styles.monitorText}>
              {configuredSafeWord ? 'Safe word armed.' : 'No safe word set.'}
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
      </ScrollView>

      {/* ── Banners (absolute overlays) ───────────────────────────── */}
      {escalated && (
        <View style={styles.escalationBanner}>
          <Text style={styles.escalationText}>🚨 Alert sent to your trusted contact</Text>
        </View>
      )}
      {rejoinedBanner && (
        <View style={styles.rejoinBanner}>
          <Text style={styles.rejoinText}>✅ Back on route!</Text>
        </View>
      )}

      <EscalationAlert
        visible={showSOSConfirmation}
        escalatedMode
        onConfirmSafe={() => setShowSOSConfirmation(false)}
        onEmergencyContact={() => setShowSOSConfirmation(false)}
      />
    </SafeAreaView>
  );
}

function deviationBadgeStyle(level: DeviationLevel) {
  switch (level) {
    case 'critical':
      return { backgroundColor: '#FEE2E2' };
    case 'warning':
      return { backgroundColor: '#FEF3C7' };
    case 'minor':
      return { backgroundColor: '#FEF9C3' };
    default:
      return { backgroundColor: '#D1FAE5' };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  containerEscalated: {
    backgroundColor: '#FFF5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusReason: {
    fontSize: 12,
    color: colors.textLight,
    fontStyle: 'italic',
    flexShrink: 1,
  },
  sosButton: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
    marginLeft: 12,
    minWidth: 64,
  },
  sosButtonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sosButtonSub: {
    color: '#FECACA',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  mapContainer: {
    height: 220,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 0,
    borderRadius: 16,
    overflow: 'hidden',
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  etaChip: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  etaChipIcon: { fontSize: 22, marginBottom: 2 },
  etaChipLabel: { fontSize: 11, color: colors.textLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  etaChipValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  etaDivider: {
    width: 1,
    height: 44,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
  companionContainer: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  voiceContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  voiceStatus: {
    fontSize: 13,
    color: colors.textLight,
    lineHeight: 18,
    marginBottom: 12,
  },
  voiceButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  permissionButton: {
    backgroundColor: colors.warning,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  permissionButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  voiceControlButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  voiceActionButton: {
    backgroundColor: colors.gray[700],
    borderRadius: 12,
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  voiceControlButtonDisabled: {
    opacity: 0.7,
  },
  voiceControlText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  voiceActionButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
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
  monitorRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  monitorText: {
    flex: 1,
    fontSize: 13,
    color: colors.textLight,
    lineHeight: 18,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  escalationBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.red,
    paddingVertical: 10,
    alignItems: 'center',
  },
  escalationText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  rejoinBanner: {
    position: 'absolute',
    bottom: 120,
    left: 24,
    right: 24,
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
  rejoinText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
