import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../constants/colors';
import { CommuteMode } from '../types';
import { checkHealth, getPlaceSuggestions, type PlaceSuggestion } from '../services/api';

export default function HomeScreen() {
  const router = useRouter();
  const [destination, setDestination]   = useState('');
  const [mode, setMode]                 = useState<CommuteMode>('walking');
  const [safeWord, setSafeWord]         = useState('');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ok' | 'offline'>('checking');
  const [suggestions, setSuggestions]   = useState<PlaceSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    checkHealth().then((ok) => setBackendStatus(ok ? 'ok' : 'offline'));
  }, []);

  const handleDestinationChange = (text: string) => {
    setDestination(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const results = await getPlaceSuggestions(text);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
    }, 300);
  };

  const handleSelectSuggestion = (suggestion: PlaceSuggestion) => {
    setDestination(suggestion.description);
    setSuggestions([]);
    setShowDropdown(false);
    Keyboard.dismiss();
  };

  const handleFindRoutes = () => {
    if (destination.trim()) {
      setShowDropdown(false);
      router.push({
        pathname: '/safety-setup',
        params: { destination, mode, safeWord },
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>

        {/* ── Header ────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>SafeWalk</Text>
          <Text style={styles.subtitle}>Your AI walking companion</Text>
        </View>

        {/* ── Backend status indicator ─────────────────────────────── */}
        <TouchableOpacity
          style={styles.statusRow}
          onPress={() => {
            setBackendStatus('checking');
            checkHealth().then((ok) => setBackendStatus(ok ? 'ok' : 'offline'));
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.statusDot, statusDotStyle(backendStatus)]} />
          <Text style={styles.statusText}>
            {backendStatus === 'checking' && 'Connecting to backend…'}
            {backendStatus === 'ok'       && 'Backend connected  ·  tap to recheck'}
            {backendStatus === 'offline'  && 'Backend offline  ·  tap to retry'}
          </Text>
        </TouchableOpacity>

        {/* ── Travel mode ───────────────────────────────────────────── */}
        <View style={styles.modeSection}>
          <Text style={styles.label}>How are you traveling?</Text>
          <View style={styles.modeButtons}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'walking' && styles.modeButtonActive]}
              onPress={() => setMode('walking')}
            >
              <Text style={styles.modeIcon}>🚶</Text>
              <Text style={[styles.modeText, mode === 'walking' && styles.modeTextActive]}>
                Walking
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeButton, mode === 'car' && styles.modeButtonActive]}
              onPress={() => setMode('car')}
            >
              <Text style={styles.modeIcon}>🚗</Text>
              <Text style={[styles.modeText, mode === 'car' && styles.modeTextActive]}>
                Car
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Destination input with autocomplete ───────────────────── */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Where are you going?</Text>
          <TextInput
            style={[styles.input, showDropdown && styles.inputOpen]}
            placeholder="Enter destination"
            placeholderTextColor={colors.textLight}
            value={destination}
            onChangeText={handleDestinationChange}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {showDropdown && suggestions.map((item, index) => (
            <TouchableOpacity
              key={item.placeId}
              style={[
                styles.suggestionItem,
                index === 0 && styles.suggestionItemFirst,
                index === suggestions.length - 1 && styles.suggestionItemLast,
              ]}
              onPress={() => handleSelectSuggestion(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionIcon}>📍</Text>
              <Text style={styles.suggestionText} numberOfLines={2}>
                {item.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.label}>Set a safe word</Text>
          <TextInput
            style={styles.input}
            placeholder="Optional phrase only you would know"
            placeholderTextColor={colors.textLight}
            value={safeWord}
            onChangeText={setSafeWord}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.helperText}>
            If this word comes up during the conversation, SafeWalk will escalate immediately.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, !destination.trim() && styles.buttonDisabled]}
          onPress={handleFindRoutes}
          disabled={!destination.trim()}
        >
          <Text style={styles.buttonText}>Find Routes</Text>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

function statusDotStyle(status: 'checking' | 'ok' | 'offline') {
  if (status === 'ok')      return { backgroundColor: colors.green };
  if (status === 'offline') return { backgroundColor: colors.red };
  return { backgroundColor: colors.yellow };
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
    marginBottom: 28,
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

  // ── Backend status ─────────────────────────────────────────────────────
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.gray[50],
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 13,
    color: colors.textLight,
    flex: 1,
  },

  // ── Rest ──────────────────────────────────────────────────────────────
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
  helperText: {
    fontSize: 13,
    color: colors.textLight,
    lineHeight: 18,
    marginTop: 8,
  },
  inputOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
    backgroundColor: colors.white,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  suggestionItemFirst: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  suggestionItemLast: {
    borderBottomWidth: 2,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  suggestionIcon: {
    fontSize: 15,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
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
