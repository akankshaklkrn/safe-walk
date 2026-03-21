import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

interface SOSButtonProps {
  onPress: () => void;
}

export default function SOSButton({ onPress }: SOSButtonProps) {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.text}>SOS</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.red,
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 4,
    borderColor: colors.white,
  },
  text: {
    color: colors.white,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
