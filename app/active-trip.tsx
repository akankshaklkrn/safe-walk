import { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '../constants/colors';
import { SafetyStatus, CommuteMode } from '../types';
import MapView from '../components/MapView';
import SafetyStatusIndicator from '../components/SafetyStatusIndicator';
import SOSButton from '../components/SOSButton';
import TripInfoBar from '../components/TripInfoBar';
import AICompanionPanel from '../components/AICompanionPanel';
import { getMockAIMessages } from '../data/mockMessages';

export default function ActiveTripScreen() {
  const { destination, routeName, mode } = useLocalSearchParams();
  const [safetyStatus, setSafetyStatus] = useState<SafetyStatus>('safe');
  const aiMessages = getMockAIMessages();

  const handleSOS = () => {
    setSafetyStatus('risk');
    Alert.alert(
      'SOS Activated',
      'Emergency alert sent to your trusted contact with your live location.',
      [{ text: 'OK' }]
    );
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

      <View style={styles.infoContainer}>
        <TripInfoBar eta="12 min" distance="0.8 mi" />
      </View>

      <View style={styles.sosContainer}>
        <SOSButton onPress={handleSOS} />
      </View>
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
    marginBottom: 16,
  },
  infoContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sosContainer: {
    alignItems: 'center',
    paddingBottom: 32,
  },
});
