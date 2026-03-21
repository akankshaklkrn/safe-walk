import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../constants/colors';
import { CommuteMode } from '../types';

export default function HomeScreen() {
  const router = useRouter();
  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState<CommuteMode>('walking');

  const handleFindRoutes = () => {
    if (destination.trim()) {
      router.push({
        pathname: '/safety-setup',
        params: { destination, mode },
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>SafeWalk</Text>
          <Text style={styles.subtitle}>Your AI walking companion</Text>
        </View>

        <View style={styles.modeSection}>
          <Text style={styles.label}>How are you traveling?</Text>
          <View style={styles.modeButtons}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'walking' && styles.modeButtonActive,
              ]}
              onPress={() => setMode('walking')}
            >
              <Text style={styles.modeIcon}>🚶</Text>
              <Text
                style={[
                  styles.modeText,
                  mode === 'walking' && styles.modeTextActive,
                ]}
              >
                Walking
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'car' && styles.modeButtonActive,
              ]}
              onPress={() => setMode('car')}
            >
              <Text style={styles.modeIcon}>🚗</Text>
              <Text
                style={[
                  styles.modeText,
                  mode === 'car' && styles.modeTextActive,
                ]}
              >
                Car
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.label}>Where are you going?</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter destination"
            placeholderTextColor={colors.textLight}
            value={destination}
            onChangeText={setDestination}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            !destination.trim() && styles.buttonDisabled,
          ]}
          onPress={handleFindRoutes}
          disabled={!destination.trim()}
        >
          <Text style={styles.buttonText}>Find Routes</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: colors.textLight,
  },
  modeSection: {
    marginBottom: 32,
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  modeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: '#F0F8FF',
  },
  modeIcon: {
    fontSize: 32,
  },
  modeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textLight,
  },
  modeTextActive: {
    color: colors.primary,
  },
  inputSection: {
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: colors.gray[300],
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
});
