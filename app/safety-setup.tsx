import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ExpoLocation from 'expo-location';
import { colors } from '../constants/colors';
import { useTripContext } from '../context/TripContext';
import { EmergencyContact, Location, LocationPermissionStatus } from '../types';

export default function SafetySetupScreen() {
  const router = useRouter();
  const { destination, mode } = useLocalSearchParams();
  const { updateTripSetup } = useTripContext();

  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [locationPermissionStatus, setLocationPermissionStatus] =
    useState<LocationPermissionStatus>('undetermined');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phoneNumber: '',
    relationship: '',
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    requestLocationPermission();
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
        setLocationError('Location permission denied. You can still continue, but some features may be limited.');
      }
    } catch (error) {
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

      const reverseGeocode = await ExpoLocation.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      const address = reverseGeocode[0]
        ? `${reverseGeocode[0].street || ''}, ${reverseGeocode[0].city || ''}, ${reverseGeocode[0].region || ''}`
        : undefined;

      setCurrentLocation({
        latitude,
        longitude,
        address,
      });
    } catch (error) {
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
      relationship: newContact.relationship.trim() || undefined,
      isPrimary: emergencyContacts.length === 0,
    };

    setEmergencyContacts([...emergencyContacts, contact]);
    setNewContact({ name: '', phoneNumber: '', relationship: '' });
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
    setEmergencyContacts(
      emergencyContacts.map((c) => ({
        ...c,
        isPrimary: c.id === id,
      }))
    );
  };

  const handleContinue = () => {
    if (emergencyContacts.length === 0) {
      Alert.alert(
        'No Emergency Contacts',
        'Please add at least one emergency contact before continuing.',
        [{ text: 'OK' }]
      );
      return;
    }

    updateTripSetup({
      destination: destination as string,
      mode: mode as 'walking' | 'car',
      currentLocation,
      locationPermissionStatus,
      emergencyContacts,
    });

    router.push({
      pathname: '/route-selection',
      params: { destination, mode },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Safety Setup</Text>
          <Text style={styles.subtitle}>
            Let's set up your safety information before we start
          </Text>
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
                {currentLocation.address || `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`}
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
              <TouchableOpacity
                style={styles.retryButton}
                onPress={requestLocationPermission}
              >
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

          {emergencyContacts.map((contact) => (
            <View key={contact.id} style={styles.contactCard}>
              <View style={styles.contactInfo}>
                <View style={styles.contactHeader}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  {contact.isPrimary && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>Primary</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.contactPhone}>{contact.phoneNumber}</Text>
                {contact.relationship && (
                  <Text style={styles.contactRelationship}>{contact.relationship}</Text>
                )}
              </View>
              <View style={styles.contactActions}>
                {!contact.isPrimary && (
                  <TouchableOpacity
                    style={styles.setPrimaryButton}
                    onPress={() => handleSetPrimary(contact.id)}
                  >
                    <Text style={styles.setPrimaryButtonText}>Set Primary</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveContact(contact.id)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {showAddContact ? (
            <View style={styles.addContactForm}>
              <TextInput
                style={[styles.input, formErrors.name && styles.inputError]}
                placeholder="Name *"
                value={newContact.name}
                onChangeText={(text) => setNewContact({ ...newContact, name: text })}
              />
              {formErrors.name && <Text style={styles.errorLabel}>{formErrors.name}</Text>}

              <TextInput
                style={[styles.input, formErrors.phoneNumber && styles.inputError]}
                placeholder="Phone Number *"
                value={newContact.phoneNumber}
                onChangeText={(text) => setNewContact({ ...newContact, phoneNumber: text })}
                keyboardType="phone-pad"
              />
              {formErrors.phoneNumber && (
                <Text style={styles.errorLabel}>{formErrors.phoneNumber}</Text>
              )}

              <TextInput
                style={styles.input}
                placeholder="Relationship (optional)"
                value={newContact.relationship}
                onChangeText={(text) => setNewContact({ ...newContact, relationship: text })}
              />

              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowAddContact(false);
                    setNewContact({ name: '', phoneNumber: '', relationship: '' });
                    setFormErrors({});
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleAddContact}>
                  <Text style={styles.saveButtonText}>Add Contact</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addContactButton}
              onPress={() => setShowAddContact(true)}
            >
              <Text style={styles.addContactButtonText}>+ Add Emergency Contact</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Continue to Route Selection</Text>
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
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textLight,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionIcon: {
    fontSize: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 12,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: colors.textLight,
  },
  locationCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  locationLabel: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  locationCoords: {
    fontSize: 13,
    color: colors.textLight,
    fontFamily: 'monospace',
  },
  errorCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.danger,
  },
  errorText: {
    fontSize: 15,
    color: colors.danger,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  contactCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  contactInfo: {
    marginBottom: 12,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  primaryBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  primaryBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  contactPhone: {
    fontSize: 15,
    color: colors.text,
    marginBottom: 2,
  },
  contactRelationship: {
    fontSize: 14,
    color: colors.textLight,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  setPrimaryButton: {
    flex: 1,
    backgroundColor: colors.gray[100],
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  setPrimaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  removeButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  addContactForm: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: colors.white,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorLabel: {
    color: colors.danger,
    fontSize: 13,
    marginTop: -8,
    marginBottom: 8,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.gray[100],
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  addContactButton: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  addContactButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  continueButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
});
