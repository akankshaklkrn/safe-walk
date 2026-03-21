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
import { useConversation } from '@elevenlabs/react-native';
import { colors } from '../constants/colors';
import { SafetyStatus, CommuteMode } from '../types';
import MapView from '../components/MapView';
import SafetyStatusIndicator from '../components/SafetyStatusIndicator';
import SOSButton from '../components/SOSButton';
import TripInfoBar from '../components/TripInfoBar';
import AICompanionPanel from '../components/AICompanionPanel';
import CheckInModal from '../components/CheckInModal';
import EscalationAlert from '../components/EscalationAlert';
import { getMockAIMessages, AIMessage } from '../data/mockMessages';
import { useTripContext } from '../context/TripContext';
import { containsSafeWord } from '../services/p3';

export default function ActiveTripScreen() {
  const router = useRouter();
  const { destination, routeName, mode, safeWord } = useLocalSearchParams();
  const { tripSetupData } = useTripContext();
  const [safetyStatus, setSafetyStatus] = useState<SafetyStatus>('safe');
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showEscalation, setShowEscalation] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('Connecting trip companion');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>(() =>
    getMockAIMessages(
      (destination as string) || 'your destination',
      (routeName as string) || 'your selected route',
      'safe'
    )
  );
  const hasStartedSessionRef = useRef(false);

  const configuredSafeWord = typeof safeWord === 'string' ? safeWord : '';
  const destinationName = (destination as string) || 'your destination';
  const selectedRouteName = (routeName as string) || 'your selected route';
  const agentId = process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_ID;
  const useServerToken = process.env.EXPO_PUBLIC_ELEVENLABS_USE_SERVER_TOKEN === 'true';
  const apiBaseUrl = Constants.expoConfig?.hostUri
    ? `http://${Constants.expoConfig.hostUri}`
    : '';
  const tokenFetchUrl =
    useServerToken && apiBaseUrl ? `${apiBaseUrl}/api/elevenlabs-token` : undefined;

  const appendMessage = (message: AIMessage) => {
    setAiMessages((currentMessages) => [...currentMessages, message]);
  };

  const conversation = useConversation({
    tokenFetchUrl,
    onConnect: ({ conversationId }) => {
      setVoiceStatus(`Companion connected: ${conversationId}`);
    },
    onDisconnect: () => {
      setVoiceStatus('Companion disconnected');
    },
    onError: (error) => {
      const message = typeof error === 'string' ? error : 'Conversation failed';
      setVoiceStatus(message);
    },
    onModeChange: ({ mode }) => {
      setVoiceStatus(mode === 'speaking' ? 'AI companion speaking' : 'Listening');
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
    if (hasStartedSessionRef.current || safetyStatus === 'risk') {
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
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Could not start conversation';
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
      setVoiceStatus(isMicMuted ? 'Mic muted' : conversation.isSpeaking ? 'AI companion speaking' : 'Listening');
    } else if (conversation.status === 'connecting') {
      setVoiceStatus('Connecting trip companion');
    } else if (conversation.status === 'disconnected' && safetyStatus !== 'risk') {
      setVoiceStatus('Trip companion offline');
    }
  }, [conversation.isSpeaking, conversation.status, isMicMuted, safetyStatus]);

  const handleEscalation = async (reason: string) => {
    setShowCheckIn(false);
    setShowEscalation(false);
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

  const handleCheckInResponse = (isOkay: boolean) => {
    setShowCheckIn(false);

    if (isOkay) {
      setSafetyStatus('safe');
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
    void handleEscalation('Manual SOS');
  };

  const handleEndTrip = async () => {
    if (conversation.status !== 'disconnected') {
      await conversation.endSession();
    }

    router.push({
      pathname: '/trip-complete',
      params: {
        destination,
        mode,
        duration: '12',
        distance: '0.8',
      },
    });
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

  const isConnected = conversation.status === 'connected';
  const isConnecting = conversation.status === 'connecting';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <SafetyStatusIndicator status={safetyStatus} />
        <Text style={styles.modeIndicator}>
          {mode === 'walking' ? '🚶 Walking' : '🚗 Driving'}
        </Text>
      </View>

      <View style={styles.mapContainer}>
        <MapView />
      </View>

      <View style={styles.companionContainer}>
        <AICompanionPanel messages={aiMessages} />
      </View>

      <View style={styles.voiceContainer}>
        <Text style={styles.inputLabel}>Trip Companion</Text>
        <Text style={styles.voiceStatus}>{voiceStatus}</Text>
        <View style={styles.voiceButtonRow}>
          <TouchableOpacity
            style={[
              styles.voiceControlButton,
              !isConnected && styles.voiceControlButtonDisabled,
            ]}
            onPress={handleMicToggle}
            disabled={!isConnected}
          >
            <Text style={styles.voiceControlText}>Mute / Unmute Mic</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.voiceActionButton,
              isConnecting && styles.voiceControlButtonDisabled,
            ]}
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
            style={[
              styles.sendButton,
              !isConnected && styles.voiceControlButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!isConnected}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.infoContainer}>
        <TripInfoBar eta="12 min" distance="0.8 mi" />
      </View>

      <View style={styles.buttonContainer}>
        <SOSButton onPress={handleSOS} />
      </View>

      <CheckInModal visible={showCheckIn} onRespond={handleCheckInResponse} />

      <EscalationAlert
        visible={showEscalation}
        onConfirmSafe={handleConfirmSafe}
        onEmergencyContact={handleEmergencyContact}
      />
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
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  modeIndicator: {
    fontSize: 14,
    color: colors.textLight,
    fontWeight: '600',
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
  buttonContainer: {
    paddingHorizontal: 24,
    alignItems: 'center',
    paddingBottom: 32,
  },
});
