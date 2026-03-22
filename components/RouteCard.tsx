import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Route } from '../types';
import { colors } from '../constants/colors';

interface RouteCardProps {
  route: Route;
  isSelected: boolean;
  onSelect: () => void;
}

export default function RouteCard({ route, isSelected, onSelect }: RouteCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.routeName}>{route.name}</Text>
        {isSelected && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedText}>✓</Text>
          </View>
        )}
      </View>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>ETA</Text>
          <Text style={styles.detailValue}>{route.eta}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Distance</Text>
          <Text style={styles.detailValue}>{route.distance}</Text>
        </View>
      </View>

      <View style={styles.observationContainer}>
        <Text style={styles.observationLabel}>Route Observation</Text>
        <Text style={styles.observationText}>{route.observation}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F0F8FF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  routeName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  selectedBadge: {
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  details: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: colors.gray[50],
    borderRadius: 12,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  observationContainer: {
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  observationLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.warning,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  observationText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
});
