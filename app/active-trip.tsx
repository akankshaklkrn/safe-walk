import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

  const [showEscalationPrompt, setShowEscalationPrompt] = useState(false);
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
  const [liveEtaMinutes, setLiveEtaMinutes] = useState<number | null>(
    etaMinutes ? parseInt(etaMinutes, 10) : null
  );
  const [liveProgressPercent, setLiveProgressPercent] = useState<number>(0);
  const initialDistanceMeters = distanceMeters ? parseInt(distanceMeters, 10) : 0;
  const [elevenLabsConversationId, setElevenLabsConversationId] = useState<string | null>(null);

  const escalatedRef = useRef(escalated);
  const hasStartedSessionRef = useRef(false);
  const countdownActiveRef = useRef(false);
  const tripStartTimeRef = useRef(Date.now());
  const lastContextUpdateRef = useRef(0);
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
    console.log('[sendEmailAlert] Starting email alert', {
      alertType,
      message,
      trustedContactEmail,
      emailAlertBaseUrl
    });

    if (!trustedContactEmail) {
      const errorMsg = 'No trusted contact email configured';
      console.error('[sendEmailAlert]', errorMsg);
      throw new Error(errorMsg);
    }

    const activeLocation = currentLocation ?? fallbackLoc.current;
    const payload = {
      userId: `trip-${tripId || 'unknown'}`,
      tripId: tripId || 'unknown-trip',
      location: activeLocation,
      timestamp: new Date().toISOString(),
      alertType,
      message,
      mode: (mode === 'car' ? 'car' : 'walking') as CommuteMode,
      trustedContactEmail,
    };

    console.log('[sendEmailAlert] Sending to:', `${emailAlertBaseUrl}/alerts/sos`);
    console.log('[sendEmailAlert] Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${emailAlertBaseUrl}/alerts/sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log('[sendEmailAlert] Response status:', response.status);

    const result = (await response.json()) as {
      ok?: boolean;
      channel?: string;
      alertId?: string;
      error?: string;
    };

    console.log('[sendEmailAlert] Response body:', result);

    if (!response.ok || !result.ok) {
      const errorMsg = result.error || 'Failed to send email alert.';
      console.error('[sendEmailAlert] Failed:', errorMsg);
      throw new Error(errorMsg);
    }

    console.log('[sendEmailAlert] Success! Alert ID:', result.alertId);

    appendMessage({
      id: `${Date.now()}-email-sent`,
      text: `Email alert sent to ${trustedContactEmail}. Alert ID: ${result.alertId || 'n/a'}.`,
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
    setShowEscalationPrompt(true);
  };

  const conversation = useTripConversation({
    tokenFetchUrl,
    onConnect: ({ conversationId }: { conversationId: string }) => {
      console.log('[ElevenLabs] Connected with conversation ID:', conversationId);
      setElevenLabsConversationId(conversationId);
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
      console.log('[ElevenLabs] Message received:', { source, message: message.substring(0, 50) });
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
        conversationLog: JSON.stringify(aiMessages),
      },
    });
  };

  const navigateEscalatedComplete = () => {
    const durationSeconds = Math.floor((Date.now() - tripStartTimeRef.current) / 1000);

    router.replace({
      pathname: '/trip-complete',
      params: {
        completedAt: new Date().toISOString(),
        actualDurationSeconds: String(durationSeconds),
        finalDistanceFromRouteMeters: '0',
        destination: destination ?? '',
        wasEscalated: 'true',
        elevenLabsConversationId: elevenLabsConversationId ?? '',
      },
    });
  };

  const handleEscalation = async (reason: string, alertType = 'critical') => {
    countdownActiveRef.current = false;
    setShowEscalationPrompt(false);
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
    setShowSOSConfirmation(true);
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

        const backendStatus = mapBackendStatus(result.status);
        const countdownInProgress =
          countdownActiveRef.current || showEscalationPrompt || showSOSConfirmation || escalatedRef.current;

        if (!countdownInProgress) {
          setSafetyStatus(backendStatus);
        } else if (escalatedRef.current || showSOSConfirmation) {
          setSafetyStatus('risk');
        } else {
          setSafetyStatus('uncertain');
        }

        setStatusReason(result.reason);
        setDeviationLevel(result.deviationLevel ?? 'none');

        // Update live ETA and progress from backend
        if (result.remainingEtaMinutes !== undefined) {
          setLiveEtaMinutes(result.remainingEtaMinutes);
        }
        if (result.progressPercent !== undefined) {
          setLiveProgressPercent(result.progressPercent);
        }

        // Update ElevenLabs agent with real-time trip data (throttled to once per minute)
        const now = Date.now();
        const timeSinceLastUpdate = now - lastContextUpdateRef.current;
        if (conversation.status === 'connected' && timeSinceLastUpdate > 60000) {
          const etaText = result.remainingEtaMinutes === 1
            ? '1 minute'
            : `${result.remainingEtaMinutes} minutes`;
          const progressText = `${result.progressPercent}%`;
          const routeStatus = result.distanceFromRouteMeters < 50
            ? 'on track'
            : `${Math.round(result.distanceFromRouteMeters)}m off route`;

          const updateMessage = `Trip update: ${etaText} remaining to ${destinationName}. Progress: ${progressText} along route. Currently ${routeStatus}.`;
          console.log('[ElevenLabs] Sending contextual update:', updateMessage);
          conversation.sendContextualUpdate(updateMessage);
          lastContextUpdateRef.current = now;
        } else if (conversation.status !== 'connected') {
          console.log('[ElevenLabs] Skipping update - conversation status:', conversation.status);
        }

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
  }, [tripId, showEscalationPrompt, showSOSConfirmation]);

  useEffect(() => {
    if (hasStartedSessionRef.current || safetyStatus === 'risk' || micPermissionGranted !== true) {
      return;
    }

    if (!agentId) {
      setVoiceStatus('Missing EXPO_PUBLIC_ELEVENLABS_AGENT_ID');
      return;
    }

    hasStartedSessionRef.current = true;
    console.log('[ElevenLabs] Starting session with agent:', agentId);
    console.log('[ElevenLabs] Dynamic variables:', { destination: destinationName, route_name: selectedRouteName, safe_word_enabled: Boolean(configuredSafeWord) });
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
        const initialMessage = `SafeWalk trip started. Destination: ${destinationName}. Route: ${selectedRouteName}. Keep the user company for the full trip. When the user asks about ETA or time remaining, you will receive regular trip updates with this information.`;
        console.log('[ElevenLabs] Session started, sending initial context:', initialMessage);
        conversation.sendContextualUpdate(initialMessage);
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
    setShowEscalationPrompt(false);
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
            console.log('[Trip End] ElevenLabs conversation ID:', elevenLabsConversationId);
            router.replace({
              pathname: '/trip-complete',
              params: {
                tripId: tripId ?? 'unknown',
                completedAt: new Date().toISOString(),
                actualDurationSeconds: String(durationSeconds),
                actualDurationMinutes: String(durationMinutes),
                finalDistanceFromRouteMeters: '0',
                finalDeviationLevel: deviationLevel ?? 'none',
                destination: destination ?? '',
                routeName: routeName ?? '',
                wasEscalated: String(escalated),
                elevenLabsConversationId: elevenLabsConversationId ?? '',
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

  const insets = useSafeAreaInsets();
  const isConnected = conversation.status === 'connected';
  const isConnecting = conversation.status === 'connecting';
  const etaLabel = liveEtaMinutes !== null ? formatEta(liveEtaMinutes) : '— min';
  // Calculate remaining distance: initial distance * (1 - progress as decimal)
  const remainingDistanceMeters = Math.round(initialDistanceMeters * (1 - liveProgressPercent / 100));
  const distanceLabel = formatDistance(remainingDistanceMeters);
  const arrivalTime =
    liveEtaMinutes !== null
      ? new Date(Date.now() + liveEtaMinutes * 60_000).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      : '—';

  return (
    <View style={styles.root}>

      {/* ── Full-screen map ───────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFillObject}>
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

      {/* ── Safety status pill — top-left ────────────────────────── */}
      <View style={[styles.statusPill, { top: insets.top + 12 }]}>
        <SafetyStatusIndicator status={safetyStatus} />
      </View>

      {/* ── Route label pill — centered top of map ───────────────── */}
      <View style={[styles.routeLabel, { top: insets.top + 12 }]}>
        <View style={styles.routeLabelDot} />
        <Text style={styles.routeLabelText}>SAFE PATH</Text>
      </View>

      {/* ── SOS button — straddling map / panel boundary ─────────── */}
      <TouchableOpacity
        style={styles.sosFab}
        activeOpacity={0.75}
        onPress={() => void handleSOS()}
      >
        <Text style={styles.sosFabLabel}>SOS</Text>
        <Text style={styles.sosFabSub}>EMERGENCY</Text>
      </TouchableOpacity>

      {/* ── Bottom sheet ─────────────────────────────────────────── */}
      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom || 16 }]}>
        <View style={styles.dragHandle} />

        {/* ── Panel header ─── avatar · name · status · menu ─────── */}
        <View style={styles.panelHeader}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>AI</Text>
            </View>
            <View style={styles.avatarOnlineDot} />
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>SafeWalk AI</Text>
            <View style={styles.headerStatus}>
              <View style={styles.statusDot} />
              <Text style={styles.statusLabel}>WATCHING OVER YOU</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.menuBtn}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.menuBtnText}>⋮</Text>
          </TouchableOpacity>
        </View>

        {/* ── Metrics row ─── arrival · distance ─────────────────── */}
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{arrivalTime}</Text>
            <Text style={styles.metricLabel}>Arrival</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{distanceLabel}</Text>
            <Text style={styles.metricLabel}>Distance</Text>
          </View>
        </View>

        {/* ── AI messages ─────────────────────────────────────────── */}
        <View style={styles.messagesArea}>
          <AICompanionPanel messages={aiMessages} />
        </View>

        {/* Mic permission (conditional) */}
        {micPermissionGranted !== true && (
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={() => void handleRequestMicPermission()}
          >
            <Text style={styles.permissionButtonText}>Enable Microphone</Text>
          </TouchableOpacity>
        )}

        {/* ── Actions ─────────────────────────────────────────────── */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              (!isConnected || micPermissionGranted !== true) && styles.actionButtonDisabled,
            ]}
            onPress={handleMicToggle}
            disabled={!isConnected || micPermissionGranted !== true}
          >
            <Text style={styles.actionButtonText}>
              {isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.endTripButton, isConnecting && styles.actionButtonDisabled]}
            onPress={() => void handleEndTrip()}
            disabled={isConnecting}
          >
            <Text style={styles.endTripButtonText}>End Trip</Text>
          </TouchableOpacity>
        </View>

        {/* ── Text input ──────────────────────────────────────────── */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.messageInput}
            placeholder="Message your companion…"
            placeholderTextColor={colors.textLight}
            value={draftMessage}
            onChangeText={setDraftMessage}
            autoCapitalize="sentences"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.sendButton, !isConnected && styles.actionButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!isConnected}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Absolute overlays ─────────────────────────────────────── */}
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
        visible={showEscalationPrompt}
        onConfirmSafe={() => void handleConfirmSafe()}
        onEmergencyContact={handleEmergencyContact}
      />
      <EscalationAlert
        visible={showSOSConfirmation}
        escalatedMode
        onConfirmSafe={navigateEscalatedComplete}
        onEmergencyContact={navigateEscalatedComplete}
      />
    </View>
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
  root: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ── Safety status pill ───────────────────────────────────────────
  statusPill: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },

  // ── Route label pill ─────────────────────────────────────────────
  routeLabel: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    zIndex: 10,
  },
  routeLabelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  routeLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },

  // ── SOS button — circular, pinned at map/panel boundary ─────────
  sosFab: {
    position: 'absolute',
    right: 20,
    bottom: '58%',
    transform: [{ translateY: 36 }],
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 12,
    zIndex: 30,
  },
  sosFabLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  sosFabSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 1,
  },

  // ── Bottom sheet ─────────────────────────────────────────────────
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '58%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },

  // ── Panel header ─────────────────────────────────────────────────
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  avatarOnlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: colors.white,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusLabel: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  menuBtn: {
    paddingLeft: 8,
  },
  menuBtnText: {
    fontSize: 22,
    color: colors.textLight,
    fontWeight: '700',
    lineHeight: 26,
  },

  // ── Metrics row ──────────────────────────────────────────────────
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textLight,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },

  // ── Messages area ────────────────────────────────────────────────
  messagesArea: {
    flex: 1,
    marginBottom: 6,
  },

  // ── Mic permission ───────────────────────────────────────────────
  permissionButton: {
    backgroundColor: colors.warning,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  permissionButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Action buttons ───────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  actionButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4F46E5',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  endTripButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  endTripButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },

  // ── Text input ───────────────────────────────────────────────────
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.gray[50],
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Absolute overlays ────────────────────────────────────────────
  escalationBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.red,
    paddingVertical: 10,
    alignItems: 'center',
    zIndex: 20,
  },
  escalationText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  rejoinBanner: {
    position: 'absolute',
    bottom: '60%',
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
    zIndex: 10,
  },
  rejoinText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
