import { View, Text, StyleSheet } from 'react-native';
import { SafetyStatus } from '../types';
import { colors } from '../constants/colors';

interface SafetyStatusIndicatorProps {
  status: SafetyStatus;
}

const statusConfig = {
  safe: {
    icon: '🟢',
    label: 'Safe',
    color: colors.green,
    bgColor: '#ECFDF5',
  },
  uncertain: {
    icon: '🟡',
    label: 'Uncertain',
    color: colors.yellow,
    bgColor: '#FFFBEB',
  },
  risk: {
    icon: '🔴',
    label: 'Risk Detected',
    color: colors.red,
    bgColor: '#FEF2F2',
  },
};

export default function SafetyStatusIndicator({ status }: SafetyStatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <View style={[styles.container, { backgroundColor: config.bgColor }]}>
      <Text style={styles.icon}>{config.icon}</Text>
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
});
