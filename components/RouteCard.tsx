import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Route } from '../types';
import { colors } from '../constants/colors';

interface RouteCardProps {
  route: Route;
  isSelected: boolean;
  onSelect: () => void;
}

export default function RouteCard({ route, isSelected, onSelect }: RouteCardProps) {
  const isSafest = route.name.toLowerCase().includes('safest');
  const isFastest = route.name.toLowerCase().includes('fastest');
  const isScenic = route.name.toLowerCase().includes('scenic');

  // Determine route icon
  let routeIcon = '📍'; // default pin
  if (isSafest) routeIcon = '🛡️'; // shield
  else if (isFastest) routeIcon = '⚡'; // lightning
  else if (isScenic) routeIcon = '🌳'; // tree

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isSafest && styles.cardSafest,
        isSelected && styles.cardSelected,
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      {/* Top Row: Icon + Title + Badge + Check */}
      <View style={styles.topRow}>
        <View style={styles.titleContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.routeIcon}>{routeIcon}</Text>
            <Text style={[styles.routeName, isSafest && styles.routeNameSafest]}>
              {route.name}
            </Text>
          </View>
          {isSafest && (
            <View style={styles.bestChoiceBadge}>
              <Text style={styles.bestChoiceText}>Best Choice</Text>
            </View>
          )}
        </View>
        {isSelected && (
          <View style={styles.checkIcon}>
            <Text style={styles.checkText}>✓</Text>
          </View>
        )}
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>ETA</Text>
          <Text style={styles.metricValue}>{route.eta}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Distance</Text>
          <Text style={styles.metricValue}>{route.distance}</Text>
        </View>
      </View>

      {/* What to Expect Section */}
      <View style={styles.expectSection}>
        <View style={styles.expectHeader}>
          <Text style={styles.expectIcon}>💡</Text>
          <Text style={styles.expectLabel}>What to expect</Text>
        </View>
        <Text style={styles.expectText}>{route.observation}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardSafest: {
    borderWidth: 2.5,
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  cardSelected: {
    borderColor: '#5b5299',
    backgroundColor: '#F8F7FC',
    shadowOpacity: 0.12,
  },

  // Top Row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeIcon: {
    fontSize: 20,
  },
  routeName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  routeNameSafest: {
    fontSize: 19,
    color: '#1E40AF',
  },
  bestChoiceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  bestChoiceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    letterSpacing: 0.3,
  },
  checkIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#5b5299',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Metrics Row
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  // What to Expect Section
  expectSection: {
    backgroundColor: '#F0F9FF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  expectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  expectIcon: {
    fontSize: 16,
  },
  expectLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  expectText: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
});
