import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
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

  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showEscalation, setShowEscalation] = useState(false);
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
  const emailAlertBaseUrl = process.env.EXPO_PUBLIC_BACKEND_URL
    ? process.env.EXPO_PUBLIC_BACKEND_URL
    : Constants.expoConfig?.hostUri
      ? `http://${Constants.expoConfig.hostUri.split(':')[0]}:3001`
      : 'http://localhost:3001';

  const appendMessage = (message: AIMessage) => {
    setAiMessages((prev) => [...prev, message]);
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
      [{ text: 'OK' }]
    );
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
    if (safetyStatus !== 'safe') {
      return;
    }

    const checkInTimer = setTimeout(() => {
      setShowCheckIn(true);
    }, 15000);

    return () => clearTimeout(checkInTimer);
  }, [safetyStatus]);

  useEffect(() => {
    if (safetyStatus !== 'uncertain' && safetyStatus !== 'risk') {
      return;
    }

    const escalationTimer = setTimeout(() => {
      setShowEscalation(true);
    }, 10000);

    return () => clearTimeout(escalationTimer);
  }, [safetyStatus]);

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
          setShowCheckIn(true);
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

  const handleCheckInResponse = async (isOkay: boolean) => {
    setShowCheckIn(false);

    if (isOkay) {
      if (tripId) {
        try {
          await submitCheckResponse(tripId, 'ok');
        } catch {}
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

  const handleSOS = async () => {
    if (tripId) {
      submitCheckResponse(tripId, 'sos').catch(() => undefined);
    }

    const activeLocation = currentLocation ?? fallbackLoc.current;
    const payload = {
      userId: `trip-${tripId || 'unknown'}`,
      tripId: tripId || 'unknown-trip',
      location: activeLocation,
      timestamp: new Date().toISOString(),
      alertType: 'sos',
      message: `Manual SOS triggered while heading to ${destinationName}.`,
      mode: (mode === 'car' ? 'car' : 'walking') as CommuteMode,
      trustedContactEmail: trustedContactEmail || undefined,
    };

    let escalationReason = 'Manual SOS';
    try {
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
      escalationReason = 'Manual SOS with email alert sent';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Could not send email alert.';
      appendMessage({
        id: `${Date.now()}-email-failed`,
        text: `Email alert failed: ${errorMessage}`,
        timestamp: new Date(),
        sender: 'ai',
      });
      escalationReason = `Manual SOS (email failed: ${errorMessage})`;
    }

    void handleEscalation(escalationReason);
  };

  const handleEndTrip = async () => {
    if (conversation.status !== 'disconnected') {
      await conversation.endSession();
    }
    router.replace('/');
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
      <View style={styles.header}>
        <SafetyStatusIndicator status={safetyStatus} />
        <Text style={styles.modeIndicator}>
          {mode === 'walking' ? '🚶 Walking' : '🚗 Driving'}
          {routeName ? `  ·  ${routeName}` : ''}
        </Text>
        {statusReason ? <Text style={styles.statusReason}>{statusReason}</Text> : null}
        <View style={[styles.deviationBadge, deviationBadgeStyle(deviationLevel)]}>
          <Text style={styles.deviationBadgeText}>{deviationLevelLabel(deviationLevel)}</Text>
        </View>
      </View>

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

      <View style={styles.companionContainer}>
        <AICompanionPanel messages={aiMessages} />
      </View>

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

      <View style={styles.infoContainer}>
        <TripInfoBar eta={etaLabel} distance={distanceLabel} />
      </View>

      <View style={styles.sosContainer}>
        <SOSButton onPress={handleSOS} />
      </View>

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

      <CheckInModal visible={showCheckIn} onRespond={handleCheckInResponse} />
      <EscalationAlert
        visible={showEscalation}
        onConfirmSafe={handleConfirmSafe}
        onEmergencyContact={handleEmergencyContact}
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
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  modeIndicator: {
    fontSize: 13,
    color: colors.textLight,
    fontWeight: '600',
  },
  statusReason: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  deviationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 2,
  },
  deviationBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  mapContainer: {
    height: 250,
    marginHorizontal: 24,
    marginBottom: 16,
  },
  companionContainer: {
    marginHorizontal: 24,
    marginBottom: 12,
  },
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
  infoContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sosContainer: {
    alignItems: 'center',
    paddingBottom: 24,
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