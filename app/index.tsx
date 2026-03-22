import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../constants/colors';
import { useAuthContext } from '../context/AuthContext';
import { getPlaceSuggestions, type PlaceSuggestion } from '../services/api';
import { CommuteMode } from '../types';

export default function HomeScreen() {
  const router = useRouter();
  const { authUser, loading, logout, profile, saveProfile } = useAuthContext();
  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState<CommuteMode>('walking');
  const [safeWord, setSafeWord] = useState('');
  const [safeWordMode, setSafeWordMode] = useState<'stored' | 'new'>('new');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading && !authUser) {
      router.replace('/login');
    }
  }, [authUser, loading, router]);

  useEffect(() => {
    if (profile?.safeWord) {
      setSafeWord(profile.safeWord);
      setSafeWordMode('stored');
    } else {
      setSafeWord('');
      setSafeWordMode('new');
    }
  }, [profile?.safeWord]);

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
    if (!destination.trim()) {
      return;
    }

    const selectedSafeWord = safeWordMode === 'stored' ? profile?.safeWord ?? '' : safeWord.trim();

    if (safeWordMode === 'new' && selectedSafeWord) {
      void saveProfile({ safeWord: selectedSafeWord });
    }

    setShowDropdown(false);
    router.push({
      pathname: '/safety-setup',
      params: { destination, mode, safeWord: selectedSafeWord },
    });
  };

  if (!authUser) {
    return <View style={styles.container} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.logoutButton} onPress={() => void logout()}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Image
            source={require('../assets/safewalk.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>SafeWalk</Text>
          <Text style={styles.subtitle}>Hi, {profile?.name || authUser.displayName || 'there'}.</Text>
          <Text style={styles.subtitleSecondary}>
            Your AI walking companion is ready for the next trip.
          </Text>
        </View>

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
          {showDropdown &&
            suggestions.map((item, index) => (
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
          <Text style={styles.label}>Safe word</Text>
          {profile?.safeWord ? (
            <View style={styles.safeWordOptions}>
              <TouchableOpacity
                style={[styles.safeWordChoice, safeWordMode === 'stored' && styles.safeWordChoiceActive]}
                onPress={() => {
                  setSafeWordMode('stored');
                  setSafeWord(profile.safeWord || '');
                }}
              >
                <Text style={[styles.safeWordChoiceText, safeWordMode === 'stored' && styles.safeWordChoiceTextActive]}>
                  Use saved word
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.safeWordChoice, safeWordMode === 'new' && styles.safeWordChoiceActive]}
                onPress={() => setSafeWordMode('new')}
              >
                <Text style={[styles.safeWordChoiceText, safeWordMode === 'new' && styles.safeWordChoiceTextActive]}>
                  Create new
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {safeWordMode === 'stored' && profile?.safeWord ? (
            <View style={styles.savedSafeWordCard}>
              <Text style={styles.savedSafeWordLabel}>Saved safe word</Text>
              <Text style={styles.savedSafeWordValue}>{profile.safeWord}</Text>
            </View>
          ) : null}

          {(safeWordMode === 'new' || !profile?.safeWord) && (
            <TextInput
              style={styles.input}
              placeholder="Optional phrase only you would know"
              placeholderTextColor={colors.textLight}
              value={safeWord}
              onChangeText={setSafeWord}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 44,
    paddingBottom: 72,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  logoImage: {
    width: 84,
    height: 84,
    marginBottom: 4,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#5b5299',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 17,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitleSecondary: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 2,
    textAlign: 'center',
  },
  logoutButton: {
    alignSelf: 'flex-end',
    marginBottom: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#5b5299',
  },
  logoutButtonText: {
    color: colors.white,
    fontWeight: '700',
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
    borderColor: '#5b5299',
    backgroundColor: '#F3F0FF',
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
    color: '#5b5299',
  },
  inputSection: {
    marginBottom: 24,
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
  safeWordOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  safeWordChoice: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
  },
  safeWordChoiceActive: {
    borderColor: '#5b5299',
    backgroundColor: '#F3F0FF',
  },
  safeWordChoiceText: {
    color: colors.text,
    fontWeight: '600',
  },
  safeWordChoiceTextActive: {
    color: '#5b5299',
  },
  savedSafeWordCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.white,
    marginBottom: 12,
  },
  savedSafeWordLabel: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 4,
  },
  savedSafeWordValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  button: {
    backgroundColor: '#5b5299',
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
