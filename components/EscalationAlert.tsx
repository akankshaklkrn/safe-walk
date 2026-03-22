import { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import { colors } from '../constants/colors';

interface EscalationAlertProps {
  visible: boolean;
  onConfirmSafe: () => void;
  onEmergencyContact: () => void;
  /** When true, shows an "Emergency Activated" confirmation instead of the check-in prompt */
  escalatedMode?: boolean;
}

export default function EscalationAlert({ 
  visible, 
  onConfirmSafe, 
  onEmergencyContact,
  escalatedMode = false,
}: EscalationAlertProps) {
  const [countdown, setCountdown] = useState(30);
  const hasEscalated = useRef(false);
  const emergencyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingEscalation = () => {
    hasEscalated.current = true;
    setCountdown(30);
    if (emergencyTimeoutRef.current) {
      clearTimeout(emergencyTimeoutRef.current);
      emergencyTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (!visible || escalatedMode) {
      setCountdown(30);
      hasEscalated.current = false;
      if (emergencyTimeoutRef.current) {
        clearTimeout(emergencyTimeoutRef.current);
        emergencyTimeoutRef.current = null;
      }
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!hasEscalated.current) {
            hasEscalated.current = true;
            emergencyTimeoutRef.current = setTimeout(() => {
              emergencyTimeoutRef.current = null;
              onEmergencyContact();
            }, 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      if (emergencyTimeoutRef.current) {
        clearTimeout(emergencyTimeoutRef.current);
        emergencyTimeoutRef.current = null;
      }
    };
  }, [visible, escalatedMode, onEmergencyContact]);

  useEffect(() => {
    if (!visible || escalatedMode) {
      Vibration.cancel();
      return;
    }

    // Repeating pattern so the user can dismiss the escalation from the lock-in countdown state.
    Vibration.vibrate([0, 700, 500], true);

    return () => {
      Vibration.cancel();
    };
  }, [visible, escalatedMode]);

  if (escalatedMode) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onConfirmSafe}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, styles.modalEscalated]}>
            <View style={styles.header}>
              <Text style={styles.warningIcon}>🚨</Text>
              <Text style={[styles.title, styles.titleEscalated]}>Emergency Activated</Text>
            </View>

            <View style={[styles.countdownContainer, styles.countdownEscalated]}>
              <Text style={[styles.countdownLabel, styles.countdownLabelEscalated]}>Alert Status</Text>
              <Text style={[styles.countdown, styles.countdownValueEscalated]}>SENT</Text>
            </View>

            <Text style={styles.message}>
              Your emergency contact has been notified with your live location and trip details.
              Stay safe — help is on the way.
            </Text>

            <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonEmergency]}
              onPress={() => {
                clearPendingEscalation();
                onConfirmSafe();
              }}
            >
              <Text style={styles.buttonTextEmergency}>OK, Got It</Text>
            </TouchableOpacity>
            </View>

            <Text style={styles.note}>
              Continue to share your location by keeping the app open.
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onConfirmSafe}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.title}>Safety Alert</Text>
          </View>

          <View style={styles.countdownContainer}>
            <Text style={styles.countdownLabel}>Auto-escalating in</Text>
            <Text style={styles.countdown}>{countdown}s</Text>
          </View>

          <Text style={styles.message}>
            We haven't heard from you and your safety status is uncertain. 
            Please confirm you're safe, or we'll contact your emergency contact.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSafe]}
              onPress={() => {
                clearPendingEscalation();
                onConfirmSafe();
              }}
            >
              <Text style={styles.buttonTextSafe}>I'm Safe</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonEmergency]}
              onPress={() => {
                clearPendingEscalation();
                onEmergencyContact();
              }}
            >
              <Text style={styles.buttonTextEmergency}>Contact Emergency Now</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.note}>
            Your emergency contact will receive your live location and a notification.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 3,
    borderColor: colors.danger,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  warningIcon: {
    fontSize: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.danger,
  },
  countdownContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  countdownLabel: {
    fontSize: 14,
    color: colors.danger,
    fontWeight: '600',
    marginBottom: 4,
  },
  countdown: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.danger,
  },
  message: {
    fontSize: 15,
    color: colors.text,
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 16,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonSafe: {
    backgroundColor: colors.primary,
  },
  buttonEmergency: {
    backgroundColor: colors.primary,
  },
  buttonTextSafe: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextEmergency: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalEscalated: {
    borderColor: '#7F1D1D',
    backgroundColor: '#FFF5F5',
  },
  titleEscalated: {
    color: '#7F1D1D',
  },
  countdownEscalated: {
    backgroundColor: '#FCA5A5',
  },
  countdownLabelEscalated: {
    color: '#7F1D1D',
  },
  countdownValueEscalated: {
    fontSize: 28,
    letterSpacing: 4,
    color: '#7F1D1D',
  },
});
