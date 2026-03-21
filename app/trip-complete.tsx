import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '../constants/colors';
import { useTripContext } from '../context/TripContext';

export default function TripCompleteScreen() {
  const router = useRouter();
  const { destination, mode, duration = '12', distance = '0.8' } = useLocalSearchParams();
  const { resetTripSetup } = useTripContext();

  const handleStartNewTrip = () => {
    resetTripSetup();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.celebrationIcon}>🎉</Text>
          <Text style={styles.title}>Trip Complete!</Text>
          <Text style={styles.subtitle}>
            You've arrived safely at your destination
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Trip Summary</Text>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Destination</Text>
            <Text style={styles.statValue}>{destination}</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Mode</Text>
            <Text style={styles.statValue}>
              {mode === 'walking' ? '🚶 Walking' : '🚗 Driving'}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>{duration} min</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{distance} mi</Text>
          </View>
        </View>

        <View style={styles.safetyCard}>
          <View style={styles.safetyHeader}>
            <Text style={styles.safetyIcon}>✅</Text>
            <Text style={styles.safetyTitle}>Safety Report</Text>
          </View>
          <Text style={styles.safetyText}>
            Your AI companion monitored your trip and you arrived safely. 
            No incidents were reported.
          </Text>
        </View>

        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>How was your experience?</Text>
          <View style={styles.feedbackButtons}>
            <TouchableOpacity style={styles.feedbackButton}>
              <Text style={styles.feedbackEmoji}>😊</Text>
              <Text style={styles.feedbackLabel}>Great</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.feedbackButton}>
              <Text style={styles.feedbackEmoji}>😐</Text>
              <Text style={styles.feedbackLabel}>Okay</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.feedbackButton}>
              <Text style={styles.feedbackEmoji}>😟</Text>
              <Text style={styles.feedbackLabel}>Poor</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.newTripButton}
          onPress={handleStartNewTrip}
        >
          <Text style={styles.newTripButtonText}>Start New Trip</Text>
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
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  celebrationIcon: {
    fontSize: 64,
    marginBottom: 16,
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
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statLabel: {
    fontSize: 15,
    color: colors.textLight,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  safetyCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  safetyIcon: {
    fontSize: 24,
  },
  safetyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.secondary,
  },
  safetyText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  feedbackCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  feedbackButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  feedbackButton: {
    alignItems: 'center',
    padding: 12,
  },
  feedbackEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  feedbackLabel: {
    fontSize: 14,
    color: colors.textLight,
  },
  newTripButton: {
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
  newTripButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
});
