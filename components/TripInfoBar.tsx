import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

interface TripInfoBarProps {
  eta: string;
  distance: string;
}

export default function TripInfoBar({ eta, distance }: TripInfoBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.infoItem}>
        <Text style={styles.label}>ETA</Text>
        <Text style={styles.value}>{eta}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.infoItem}>
        <Text style={styles.label}>Distance</Text>
        <Text style={styles.value}>{distance}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  label: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
});
