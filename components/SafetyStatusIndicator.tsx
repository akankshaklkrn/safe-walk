import { View, Text, StyleSheet } from 'react-native';
import { SafetyStatus } from '../types';

interface SafetyStatusIndicatorProps {
  status: SafetyStatus;
}

const STATUS_CONFIG: Record<SafetyStatus, {
  dot: string;
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}> = {
  safe: {
    dot: '#10B981',
    label: 'Safe',
    textColor: '#065F46',
    bgColor: 'rgba(236,253,245,0.92)',
    borderColor: 'rgba(16,185,129,0.30)',
  },
  uncertain: {
    dot: '#F59E0B',
    label: 'Uncertain',
    textColor: '#92400E',
    bgColor: 'rgba(255,251,235,0.92)',
    borderColor: 'rgba(245,158,11,0.30)',
  },
  risk: {
    dot: '#EF4444',
    label: 'Risk',
    textColor: '#991B1B',
    bgColor: 'rgba(254,242,242,0.92)',
    borderColor: 'rgba(239,68,68,0.35)',
  },
};

export default function SafetyStatusIndicator({ status }: SafetyStatusIndicatorProps) {
  const cfg = STATUS_CONFIG[status];

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: cfg.bgColor, borderColor: cfg.borderColor },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.label, { color: cfg.textColor }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
