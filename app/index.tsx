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
  const { authUser, loading, logout, profile, saveProfile, saveRecentSearch } = useAuthContext();
  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState<CommuteMode>('walking');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [safeWordMode, setSafeWordMode] = useState<'saved' | 'new'>('saved');
  const [newSafeWord, setNewSafeWord] = useState('');

  const hasSavedWord = Boolean(profile?.safeWord);
  const effectiveSafeWord =
    safeWordMode === 'saved' && hasSavedWord ? (profile!.safeWord ?? '') : newSafeWord;

  useEffect(() => {
    if (!loading && !authUser) {
      router.replace('/login');
    }
  }, [authUser, loading, router]);

  useEffect(() => {
    if (profile && !profile.safeWord) {
      setSafeWordMode('new');
    }
  }, [profile]);


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
    if (!destination.trim() || !effectiveSafeWord.trim()) return;

    if (safeWordMode === 'new' && newSafeWord.trim()) {
      void saveProfile({ safeWord: newSafeWord.trim() });
    }

    const normalizedDestination = destination.trim();
    void saveRecentSearch(normalizedDestination);
    setShowDropdown(false);
    router.push({
      pathname: '/safety-setup',
      params: { destination: normalizedDestination, mode, safeWord: effectiveSafeWord.trim() },
    });
  };

  const handleSelectRecent = (search: string) => {
    setDestination(search);
    setSuggestions([]);
    setShowDropdown(false);
  };

  if (!authUser) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <Image
            source={require('../assets/safewalk.png')}
            style={styles.appBarLogo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.appBarTitle}>SafeWalk</Text>
        <View style={styles.appBarRight}>
          <TouchableOpacity style={styles.logoutButton} onPress={() => void logout()}>
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Status Pill */}
          <View style={styles.statusPill}>
            <View style={styles.statusDotOnline} />
            <Text style={styles.statusPillText}>AI COMPANION ONLINE</Text>
          </View>

          {/* Hero Section */}
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Where to, {profile?.name || authUser.displayName || 'Hemang'}?</Text>
            <Text style={styles.heroSubtitle}>
              Your AI companion will stay with you every step of the trip to ensure you arrive safely.
            </Text>
          </View>

          {/* Commute Mode */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>COMMUTE MODE</Text>
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

          {/* Destination */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DESTINATION</Text>
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

          {/* Danger Word */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DANGER WORD</Text>

            {/* Saved / New toggle */}
            <View style={styles.swToggle}>
              <TouchableOpacity
                style={[styles.swOption, safeWordMode === 'saved' && styles.swOptionActive]}
                onPress={() => setSafeWordMode('saved')}
                disabled={!hasSavedWord}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.swOptionText,
                  safeWordMode === 'saved' && styles.swOptionTextActive,
                  !hasSavedWord && styles.swOptionTextDisabled,
                ]}>
                  Use saved word
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.swOption, safeWordMode === 'new' && styles.swOptionActive]}
                onPress={() => setSafeWordMode('new')}
                activeOpacity={0.7}
              >
                <Text style={[styles.swOptionText, safeWordMode === 'new' && styles.swOptionTextActive]}>
                  Create new
                </Text>
              </TouchableOpacity>
            </View>

            {/* Display: saved word box OR new word input */}
            {safeWordMode === 'saved' && hasSavedWord ? (
              <View style={styles.savedWordBox}>
                <Text style={styles.savedWordLabel}>SAVED WORD</Text>
                <Text style={styles.savedWordValue}>{profile!.safeWord}</Text>
              </View>
            ) : (
              <TextInput
                style={styles.swInput}
                placeholder="e.g. umbrella, lighthouse…"
                placeholderTextColor={colors.gray[400]}
                value={newSafeWord}
                onChangeText={setNewSafeWord}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}

            <Text style={styles.swHelper}>
              If this word is spoken, SafeWalk will trigger emergency escalation.
            </Text>
          </View>

          {/* Recent Destinations */}
          <View style={styles.section}>
            <View style={styles.recentHeader}>
              <Text style={styles.recentLabel}>Recent</Text>
            </View>
            {(profile?.recentSearches ?? []).length === 0 ? (
              <Text style={styles.recentEmptyText}>Your last two searches will appear here.</Text>
            ) : null}
            {(profile?.recentSearches ?? []).map((search: string) => (
              <TouchableOpacity
                key={search}
                style={styles.recentCard}
                onPress={() => handleSelectRecent(search)}
              >
                <View style={styles.recentIcon}>
                  <Text style={styles.recentIconText}>📍</Text>
                </View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentName} numberOfLines={1}>{search}</Text>
                  <Text style={styles.recentAddress}>Tap to use this destination</Text>
                </View>
                <Text style={styles.recentChevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* CTA Button */}
          <TouchableOpacity
            style={[styles.ctaButton, (!destination.trim() || !effectiveSafeWord.trim()) && styles.ctaButtonDisabled]}
            onPress={handleFindRoutes}
            disabled={!destination.trim() || !effectiveSafeWord.trim()}
          >
            <Text style={styles.ctaButtonText}>Find Safest Routes</Text>
          </TouchableOpacity>

          {/* Helper Text */}
          <Text style={styles.ctaHelper}>AI ACTIVE MONITORING DURING TRANSIT</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tab}>
          <Text style={styles.tabIcon}>🏠</Text>
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <View style={styles.tabIconContainer}>
            <Text style={styles.tabIcon}>🛡️</Text>
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationText}>9</Text>
            </View>
          </View>
          <Text style={styles.tabLabel}>Safety</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text style={styles.tabIcon}>👤</Text>
          <Text style={styles.tabLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  appBarLeft: {
    width: 80,
    alignItems: 'flex-start',
  },
  appBarLogo: {
    width: 36,
    height: 36,
    backgroundColor: '#5b5299',
    borderRadius: 8,
    padding: 4,
  },
  appBarTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#5b5299',
    letterSpacing: -0.5,
  },
  appBarRight: {
    width: 110,
    justifyContent: 'flex-end',
  },
  iconButton: {
    padding: 6,
    borderRadius: 8,
  },
  iconText: {
    fontSize: 22,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },

  // Status Pill
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F0F9F4',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1EAD9',
    gap: 8,
    marginBottom: 24,
  },
  statusDotOnline: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#34A853',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E7E34',
    letterSpacing: 1.2,
  },

  // Hero Section
  hero: {
    marginBottom: 32,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 1.5,
    marginBottom: 12,
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
    backgroundColor: '#EEEAFE',
  },
  logoutButtonText: {
    color: '#5b5299',
    fontWeight: '700',
  },
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
  modeSection: {
    marginBottom: 32,
  },
  modeButtons: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },
  modeButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  modeIcon: {
    fontSize: 20,
  },
  modeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  modeTextActive: {
    color: '#1A1A1A',
    fontWeight: '700',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 48,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1A1A1A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
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

  // Recent Destinations
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  recentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  recentEmptyText: {
    fontSize: 14,
    color: colors.textLight,
    paddingVertical: 8,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  recentIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  recentIconText: {
    fontSize: 20,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  recentAddress: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
  },
  recentChevron: {
    fontSize: 18,
    color: '#9CA3AF',
    marginLeft: 8,
  },

  // CTA Button
  ctaButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0.05,
    elevation: 1,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  ctaHelper: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textAlign: 'center',
    letterSpacing: 1.2,
    marginTop: 12,
  },

  // Bottom Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingBottom: 24,
    paddingTop: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  tabIconContainer: {
    position: 'relative',
  },
  tabIcon: {
    fontSize: 24,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabLabelActive: {
    color: '#1A1A1A',
    fontWeight: '700',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },

  // Danger Word
  swToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
    gap: 3,
    marginBottom: 12,
  },
  swOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  swOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  swOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  swOptionTextActive: {
    color: '#1A1A1A',
  },
  swOptionTextDisabled: {
    opacity: 0.35,
  },
  savedWordBox: {
    backgroundColor: colors.gray[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  savedWordLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gray[400],
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  savedWordValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  swInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1A1A1A',
    marginBottom: 10,
  },
  swHelper: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 17,
  },

  // Legacy styles (kept for compatibility)
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
