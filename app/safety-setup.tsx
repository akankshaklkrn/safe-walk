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
  const { authUser, authError, emergencyContacts: savedContacts, loading: authLoading, saveEmergencyContacts } =
    useAuthContext();
  const { updateTripSetup } = useTripContext();

  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [locationPermissionStatus, setLocationPermissionStatus] =
    useState<LocationPermissionStatus>('undetermined');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [savingContacts, setSavingContacts] = useState(false);

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    relationship: '',
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

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
        ? `${reverseGeocode[0].street || ''}, ${reverseGeocode[0].city || ''}, ${reverseGeocode[0].region || ''}`
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
    setShowAddContact(false);
  };

  const handleRemoveContact = (id: string) => {
    const updatedContacts = emergencyContacts.filter((c) => c.id !== id);

    if (updatedContacts.length > 0 && !updatedContacts.some((c) => c.isPrimary)) {
      updatedContacts[0].isPrimary = true;
    }

    setEmergencyContacts(updatedContacts);
  };

  const handleSetPrimary = (id: string) => {
    setEmergencyContacts((prev) =>
      prev.map((c) => ({
        ...c,
        isPrimary: c.id === id,
      }))
    );
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
      await saveEmergencyContacts(emergencyContacts);
      updateTripSetup({
        destination: destination || '',
        mode: mode || 'walking',
        currentLocation,
        locationPermissionStatus,
        emergencyContacts,
      });

      router.push({
        pathname: '/route-selection',
        params: { destination, mode, safeWord },
      });
    } catch {
      Alert.alert('Could not save contacts', authError || 'Please check the contact details and try again.');
    } finally {
      setSavingContacts(false);
    }
  };

  if (!authUser) {
    return <SafeAreaView style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Safety Setup</Text>
          <Text style={styles.subtitle}>
            Review location, emergency contacts, and the safe word you will use on this trip.
          </Text>
          {safeWord ? <Text style={styles.safeWordNotice}>Current trip safe word: {safeWord}</Text> : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📍</Text>
            <Text style={styles.sectionTitle}>Current Location</Text>
          </View>

          {isLoadingLocation ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Requesting location permission...</Text>
            </View>
          ) : locationPermissionStatus === 'granted' && currentLocation ? (
            <View style={styles.locationCard}>
              <Text style={styles.locationLabel}>Your current location:</Text>
              <Text style={styles.locationText}>
                {currentLocation.address ||
                  `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`}
              </Text>
              <Text style={styles.locationCoords}>
                {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              </Text>
            </View>
          ) : (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>
                {locationError || 'Location permission not granted'}
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => void requestLocationPermission()}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>👥</Text>
            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
          </View>

          {emergencyContacts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No saved contacts yet. Add one below.</Text>
            </View>
          ) : null}

          {emergencyContacts.map((contact) => (
            <View key={contact.id} style={styles.contactCard}>
              <View style={styles.contactInfo}>
                <View style={styles.contactHeader}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  {contact.isPrimary ? (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>Primary</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.contactPhone}>{contact.phoneNumber}</Text>
                <Text style={styles.contactEmail}>{contact.email}</Text>
                {contact.relationship ? (
                  <Text style={styles.contactRelationship}>{contact.relationship}</Text>
                ) : null}
              </View>
              <View style={styles.contactActions}>
                {!contact.isPrimary ? (
                  <TouchableOpacity
                    style={styles.setPrimaryButton}
                    onPress={() => handleSetPrimary(contact.id)}
                  >
                    <Text style={styles.setPrimaryButtonText}>Set Primary</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveContact(contact.id)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.addContactButton}
            onPress={() => setShowAddContact((prev) => !prev)}
          >
            <Text style={styles.addContactButtonText}>
              {showAddContact ? 'Cancel' : 'Add Emergency Contact'}
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

          {authError ? <Text style={styles.fieldError}>{authError}</Text> : null}
        </View>

        <TouchableOpacity
          style={[styles.continueButton, savingContacts && styles.continueButtonDisabled]}
          onPress={() => void handleContinue()}
          disabled={savingContacts}
        >
          {savingContacts ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.continueButtonText}>Continue to Routes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
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
    marginBottom: 24,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
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
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  emptyStateText: {
    color: colors.textLight,
  },
  contactCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
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
  primaryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EAF3FF',
  },
  primaryBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
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
  setPrimaryButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  setPrimaryButtonText: {
    color: colors.white,
    fontWeight: '700',
  },
  removeButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    alignItems: 'center',
  },
  removeButtonText: {
    color: colors.danger,
    fontWeight: '700',
  },
  addContactButton: {
    borderRadius: 12,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  addContactButtonText: {
    color: colors.white,
    fontWeight: '700',
  },
  addContactForm: {
    marginTop: 14,
    gap: 10,
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
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.65,
  },
  continueButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
});
