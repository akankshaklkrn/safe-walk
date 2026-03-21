import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

export default function MapView() {
  return (
    <View style={styles.container}>
      <View style={styles.placeholder}>
        <Text style={styles.icon}>🗺️</Text>
        <Text style={styles.text}>Map View</Text>
        <Text style={styles.subtext}>(Google Maps integration - coming soon)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[100],
    borderRadius: 16,
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  text: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  subtext: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
  },
});
