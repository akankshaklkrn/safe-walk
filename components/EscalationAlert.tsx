import { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

interface EscalationAlertProps {
  visible: boolean;
  onConfirmSafe: () => void;
  onEmergencyContact: () => void;
}

export default function EscalationAlert({ 
  visible, 
  onConfirmSafe, 
  onEmergencyContact 
}: EscalationAlertProps) {
  const [countdown, setCountdown] = useState(30);
  const hasEscalated = useRef(false);

  useEffect(() => {
    if (!visible) {
      setCountdown(30);
      hasEscalated.current = false;
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!hasEscalated.current) {
            hasEscalated.current = true;
            setTimeout(() => onEmergencyContact(), 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, onEmergencyContact]);

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
              onPress={onConfirmSafe}
            >
              <Text style={styles.buttonTextSafe}>I'm Safe</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonEmergency]}
              onPress={onEmergencyContact}
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
    backgroundColor: colors.secondary,
  },
  buttonEmergency: {
    backgroundColor: colors.danger,
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
});
