import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text, TouchableOpacity,
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
  const [aiMessages, setAiMessages] = useState<AIMessage[]>(getMockAIMessages());

  useEffect(() => {
    const checkInTimer = setTimeout(() => {
      setShowCheckIn(true);
    }, 15000);

    return () => clearTimeout(checkInTimer);
  }, []);

  useEffect(() => {
    if (safetyStatus === 'uncertain' || safetyStatus === 'risk') {
      const escalationTimer = setTimeout(() => {
        setShowEscalation(true);
      }, 10000);

      return () => clearTimeout(escalationTimer);
    }
  }, [safetyStatus]);

  const handleCheckInResponse = (isOkay: boolean) => {
    setShowCheckIn(false);

    if (isOkay) {
      setSafetyStatus('safe');
      const newMessage: AIMessage = {
        id: Date.now().toString(),
        text: "Great! Glad you're doing well. Keep going!",
        timestamp: new Date(),
      };
      setAiMessages([...aiMessages, newMessage]);
    } else {
      setSafetyStatus('uncertain');
      const newMessage: AIMessage = {
        id: Date.now().toString(),
        text: "I'm here to help. Let me know if you need anything or use the SOS button if it's urgent.",
        timestamp: new Date(),
      };
      setAiMessages([...aiMessages, newMessage]);
    }
  };

  const handleConfirmSafe = () => {
    setShowEscalation(false);
    setSafetyStatus('safe');
    const newMessage: AIMessage = {
      id: Date.now().toString(),
      text: "Glad to hear you're safe! Continuing to monitor your trip.",
      timestamp: new Date(),
    };
    setAiMessages([...aiMessages, newMessage]);
  };

  const handleEmergencyContact = () => {
    setShowEscalation(false);
    setSafetyStatus('risk');
    const newMessage: AIMessage = {
      id: Date.now().toString(),
      text: "Emergency protocol activated. Your emergency contact has been notified with your live location and trip details.",
      timestamp: new Date(),
    };
    setAiMessages([...aiMessages, newMessage]);
    Alert.alert(
      'Emergency Contact Notified',
      'Your emergency contact has been sent your live location and a notification that you need help.',
      [{ text: 'OK' }]
    );
  };

  const handleSOS = () => {
    setSafetyStatus('risk');
    const newMessage: AIMessage = {
      id: Date.now().toString(),
      text: "Emergency alert sent! Your trusted contact has been notified with your live location.",
      timestamp: new Date(),
    };
    setAiMessages([...aiMessages, newMessage]);
    Alert.alert(
      'Escalation Triggered',
      `Emergency alert sent to your trusted contact with your live location. Reason: ${reason}.`,
      [{ text: 'OK' }]
    );
  };

  const handleEndTrip = () => {
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
              styles.endTripButton,
              isConnecting && styles.voiceControlButtonDisabled,
            ]}
            onPress={() => void handleEndTrip()}
            disabled={isConnecting}
          >
            <Text style={styles.endTripButtonText}>End Trip</Text>
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
            {configuredSafeWord ? 'Safe word armed during the full live conversation.' : 'No safe word configured.'}
          </Text>
          <TouchableOpacity
            style={[
              styles.sendButton,
              conversation.status !== 'connected' && styles.voiceControlButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={conversation.status !== 'connected'}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.infoContainer}>
        <TripInfoBar eta="12 min" distance="0.8 mi" />
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.endTripButton}
          onPress={handleEndTrip}
        >
          <Text style={styles.endTripButtonText}>End Trip</Text>
        </TouchableOpacity>
        <SOSButton onPress={handleSOS} />
      </View>

      <CheckInModal
        visible={showCheckIn}
        onRespond={handleCheckInResponse}
      />

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
  voiceControlButtonDisabled: {
    opacity: 0.7,
  },
  voiceControlText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  endTripButton: {
    backgroundColor: colors.gray[700],
    borderRadius: 12,
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  endTripButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  voiceStatus: {
    fontSize: 13,
    color: colors.textLight,
    lineHeight: 18,
    marginBottom: 12,
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
    gap: 12,
    alignItems: 'center',
    paddingBottom: 32,
  },
  endTripButton: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  endTripButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
