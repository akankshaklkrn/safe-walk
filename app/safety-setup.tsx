import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ExpoLocation from 'expo-location';
import { colors } from '../constants/colors';
import { useAuthContext } from '../context/AuthContext';
import { useTripContext } from '../context/TripContext';
import { EmergencyContact, Location, LocationPermissionStatus } from '../types';

export default function SafetySetupScreen() {
  const router = useRouter();
  const { destination, mode, safeWord } = useLocalSearchParams<{
    destination: string;
    mode: 'walking' | 'car';
    safeWord: string;
  }>();
  const { authUser, emergencyContacts: savedContacts, loading: authLoading, authError, saveEmergencyContacts } =
    useAuthContext();
  const { updateTripSetup } = useTripContext();

  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [locationPermissionStatus, setLocationPermissionStatus] =
    useState<LocationPermissionStatus>('undetermined');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [savingContacts, setSavingContacts] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    relationship: '',
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [checkInFrequency, setCheckInFrequency] = useState<'5min' | '15min' | 'smart'>('smart');
  const [isSilentMode, setIsSilentMode] = useState(false);
  const [routeDeviationAlerts, setRouteDeviationAlerts] = useState(true);

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.replace('/login');
    }
  }, [authLoading, authUser, router]);

  useEffect(() => {
    setEmergencyContacts(savedContacts);
  }, [savedContacts]);

  useEffect(() => {
    void requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    setIsLoadingLocation(true);
    setLocationError(null);

    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        setLocationPermissionStatus('granted');
        await fetchCurrentLocation();
      } else {
        setLocationPermissionStatus('denied');
        setLocationError(
          'Location permission denied. You can still continue, but some features may be limited.'
        );
      }
    } catch {
      setLocationPermissionStatus('denied');
      setLocationError('Failed to request location permission.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const fetchCurrentLocation = async () => {
    try {
      const location = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      const reverseGeocode = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
      const address = reverseGeocode[0]
        ? [reverseGeocode[0].street, reverseGeocode[0].city, reverseGeocode[0].region]
            .filter((part): part is string => Boolean(part && part.trim()))
            .join(', ')
        : undefined;

      setCurrentLocation({ latitude, longitude, address });
    } catch {
      setLocationError('Failed to fetch current location. Please try again.');
    }
  };

  const validateContactForm = () => {
    const errors: { [key: string]: string } = {};

    if (!newContact.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!newContact.phoneNumber.trim()) {
      errors.phoneNumber = 'Phone number is required';
    } else if (!/^\+?[\d\s\-()]+$/.test(newContact.phoneNumber)) {
      errors.phoneNumber = 'Invalid phone number format';
    }

    if (!newContact.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newContact.email.trim())) {
      errors.email = 'Invalid email format';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddContact = () => {
    if (!validateContactForm()) {
      return;
    }

    const contact: EmergencyContact = {
      id: Date.now().toString(),
      name: newContact.name.trim(),
      phoneNumber: newContact.phoneNumber.trim(),
      email: newContact.email.trim().toLowerCase(),
      relationship: newContact.relationship.trim() || undefined,
      isPrimary: emergencyContacts.length === 0,
    };

    setEmergencyContacts((prev) => [...prev, contact]);
    setNewContact({ name: '', phoneNumber: '', email: '', relationship: '' });
    setFormErrors({});
    setSaveError(null);
    setShowAddContact(false);
  };

  const handleRemoveContact = (id: string) => {
    const updatedContacts = emergencyContacts.filter((c) => c.id !== id);

    if (updatedContacts.length > 0 && !updatedContacts.some((c) => c.isPrimary)) {
      updatedContacts[0].isPrimary = true;
    }

    setEmergencyContacts(updatedContacts);
  };


  const handleContinue = async () => {
    if (emergencyContacts.length === 0) {
      Alert.alert(
        'No Emergency Contacts',
        'Please add at least one emergency contact before continuing.',
        [{ text: 'OK' }]
      );
      return;
    }

    setSavingContacts(true);
    try {
      setSaveError(null);
      await saveEmergencyContacts(emergencyContacts);
      updateTripSetup({
        destination: destination || '',
        mode: mode || 'walking',
        currentLocation,
        locationPermissionStatus,
        emergencyContacts,
        isSilentMode,
        routeDeviationAlerts,
      });

      router.push({
        pathname: '/route-selection',
        params: {
          destination,
          mode,
          safeWord,
          isSilentMode: String(isSilentMode),
          routeDeviationAlerts: String(routeDeviationAlerts),
        },
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save emergency contacts.');
    } finally {
      setSavingContacts(false);
    }
  };

  if (!authUser) {
    return <SafeAreaView style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Safety Setup</Text>
        <View style={styles.appBarRight}>
          <TouchableOpacity style={styles.iconButton}>
            <Text style={styles.iconText}>�</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Text style={styles.iconText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Your Safety Net</Text>
          <Text style={styles.heroSubtitle}>
            Setup who to contact and how the AI should watch over you during your journey.
          </Text>
        </View>

        {authError || saveError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{saveError || authError}</Text>
          </View>
        ) : null}


        {/* Emergency Contacts Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionIcon}>👥</Text>
              <Text style={styles.sectionTitle}>Emergency Contacts</Text>
            </View>
            <Text style={styles.contactCounter}>{emergencyContacts.length} of 5 added</Text>
          </View>

          <View style={styles.contactsContainer}>
            {emergencyContacts.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No saved contacts yet. Add one below.</Text>
              </View>
            ) : null}

            {emergencyContacts.map((contact) => (
              <View key={contact.id} style={styles.contactRow}>
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactAvatarText}>
                    {contact.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.contactRowInfo}>
                  <View style={styles.contactRowHeader}>
                    <Text style={styles.contactRowName}>{contact.name}</Text>
                    {contact.isPrimary ? (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.contactRowPhone}>{contact.phoneNumber}</Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteIcon}
                  onPress={() => handleRemoveContact(contact.id)}
                >
                  <Text style={styles.deleteIconText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={styles.addContactButton}
              onPress={() => setShowAddContact((prev) => !prev)}
            >
              <Text style={styles.addContactButtonText}>
                {showAddContact ? 'Cancel' : '+ Add New Contact'}
              </Text>
            </TouchableOpacity>

            {showAddContact ? (
              <View style={styles.addContactForm}>
              <TextInput
                style={styles.input}
                placeholder="Name"
                value={newContact.name}
                onChangeText={(value) => setNewContact((prev) => ({ ...prev, name: value }))}
              />
              {formErrors.name ? <Text style={styles.fieldError}>{formErrors.name}</Text> : null}

              <TextInput
                style={styles.input}
                placeholder="Phone number"
                value={newContact.phoneNumber}
                onChangeText={(value) => setNewContact((prev) => ({ ...prev, phoneNumber: value }))}
                keyboardType="phone-pad"
              />
              {formErrors.phoneNumber ? <Text style={styles.fieldError}>{formErrors.phoneNumber}</Text> : null}

              <TextInput
                style={styles.input}
                placeholder="Email"
                value={newContact.email}
                onChangeText={(value) => setNewContact((prev) => ({ ...prev, email: value }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {formErrors.email ? <Text style={styles.fieldError}>{formErrors.email}</Text> : null}

              <TextInput
                style={styles.input}
                placeholder="Relationship (optional)"
                value={newContact.relationship}
                onChangeText={(value) => setNewContact((prev) => ({ ...prev, relationship: value }))}
              />

                <TouchableOpacity style={styles.saveContactButton} onPress={handleAddContact}>
                  <Text style={styles.saveContactButtonText}>Save Contact</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>

        {/* Check-in Frequency Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionIcon}>⏱️</Text>
              <Text style={styles.sectionTitle}>Check-in Frequency</Text>
            </View>
          </View>

          <View style={styles.frequencyOptions}>
            <TouchableOpacity
              style={[styles.frequencyOption, checkInFrequency === '5min' && styles.frequencyOptionActive]}
              onPress={() => setCheckInFrequency('5min')}
            >
              <Text style={[styles.frequencyText, checkInFrequency === '5min' && styles.frequencyTextActive]}>
                5 Min
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.frequencyOption, checkInFrequency === '15min' && styles.frequencyOptionActive]}
              onPress={() => setCheckInFrequency('15min')}
            >
              <Text style={[styles.frequencyText, checkInFrequency === '15min' && styles.frequencyTextActive]}>
                15 Min
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.frequencyOption, checkInFrequency === 'smart' && styles.frequencyOptionActive]}
              onPress={() => setCheckInFrequency('smart')}
            >
              <Text style={[styles.frequencyText, checkInFrequency === 'smart' && styles.frequencyTextActive]}>
                Smart
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.frequencyHelper}>
            Smart mode adjusts frequency based on route safety data and your movement patterns.
          </Text>
        </View>

        {/* Safety Preferences Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionIcon}>🛡️</Text>
              <Text style={styles.sectionTitle}>Safety Preferences</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.preferenceCard}
            onPress={() => setIsSilentMode((prev) => !prev)}
          >
            <View style={styles.preferenceIcon}>
              <Text style={styles.preferenceIconText}>🛡️</Text>
            </View>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceTitle}>Silent Alarm Mode</Text>
              <Text style={styles.preferenceDescription}>
                Hold volume buttons for 3s to notify contacts without alerting others.
              </Text>
            </View>
            <View style={[styles.toggle, isSilentMode && styles.toggleActive]}>
              <View style={[styles.toggleThumb, isSilentMode && styles.toggleThumbActive]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.preferenceCard}
            onPress={() => setRouteDeviationAlerts((prev) => !prev)}
          >
            <View style={styles.preferenceIcon}>
              <Text style={styles.preferenceIconText}>⚠️</Text>
            </View>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceTitle}>Route Deviation Alerts</Text>
              <Text style={styles.preferenceDescription}>
                Notify primary contact if I stray more than 200m from planned route.
              </Text>
            </View>
            <View style={[styles.toggle, routeDeviationAlerts && styles.toggleActive]}>
              <View style={[styles.toggleThumb, routeDeviationAlerts && styles.toggleThumbActive]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Bottom CTA */}
        <TouchableOpacity
          style={[styles.continueButton, savingContacts && styles.continueButtonDisabled]}
          onPress={() => void handleContinue()}
          disabled={savingContacts}
        >
          {savingContacts ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.continueButtonText}>Save & Continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // App Bar
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
  backButton: {
    width: 80,
    alignItems: 'flex-start',
  },
  backIcon: {
    fontSize: 24,
    color: '#1A1A1A',
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  appBarRight: {
    flexDirection: 'row',
    gap: 12,
    width: 80,
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
    padding: 20,
    paddingBottom: 40,
  },

  // Hero Section
  hero: {
    marginBottom: 36,
    paddingHorizontal: 0,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },

  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    color: colors.textLight,
    lineHeight: 22,
  },
  safeWordNotice: {
    marginTop: 10,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionIcon: {
    fontSize: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  contactCounter: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },

  // Contacts Container
  contactsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.textLight,
  },
  locationCard: {
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    padding: 14,
  },
  locationLabel: {
    fontSize: 13,
    color: colors.textLight,
    marginBottom: 6,
  },
  locationText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  locationCoords: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textLight,
  },
  errorCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 14,
  },
  errorText: {
    color: colors.danger,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: colors.white,
    fontWeight: '700',
  },
  emptyState: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 24,
    margin: 16,
  },
  emptyStateText: {
    color: '#9CA3AF',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },

  // Contact Row (compact list style)
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#5b5299',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  contactAvatarText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  contactRowInfo: {
    flex: 1,
  },
  contactRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  contactRowName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  primaryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  primaryBadgeText: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '700',
  },
  contactRowPhone: {
    fontSize: 14,
    color: '#6B7280',
  },
  deleteIcon: {
    padding: 8,
    marginLeft: 4,
  },
  deleteIconText: {
    fontSize: 22,
    color: '#9CA3AF',
    fontWeight: '400',
  },

  // Legacy contact styles (kept for compatibility)
  contactInfo: {
    gap: 4,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  contactPhone: {
    color: colors.text,
  },
  contactEmail: {
    color: colors.textLight,
  },
  contactRelationship: {
    color: colors.textLight,
    fontStyle: 'italic',
  },
  contactActions: {
    flexDirection: 'row',
    gap: 10,
  },
  addContactButton: {
    borderRadius: 0,
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  addContactButtonText: {
    color: '#5b5299',
    fontWeight: '600',
    fontSize: 15,
  },
  addContactForm: {
    marginTop: 14,
    gap: 10,
  },
  errorBanner: {
    marginHorizontal: 24,
    marginBottom: 8,
    backgroundColor: 'rgba(231,76,60,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.18)',
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.white,
  },
  fieldError: {
    color: colors.danger,
    fontSize: 13,
    marginTop: -4,
  },
  saveContactButton: {
    marginTop: 4,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveContactButtonText: {
    color: colors.white,
    fontWeight: '700',
  },
  // Check-in Frequency
  frequencyOptions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  frequencyOption: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 0,
  },
  frequencyOptionActive: {
    backgroundColor: '#1A1A1A',
  },
  frequencyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  frequencyTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  frequencyHelper: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 19,
  },

  // Preference Cards
  preferenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  preferenceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  preferenceIconText: {
    fontSize: 22,
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 12,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  preferenceDescription: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 19,
  },

  // Legacy Toggle Cards (kept for compatibility)
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D1D5DB',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#5b5299',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },

  continueButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonDisabled: {
    opacity: 0.65,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
