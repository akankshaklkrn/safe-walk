import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../constants/colors';
import { useAuthContext } from '../context/AuthContext';

export default function SignupScreen() {
  const router = useRouter();
  const { authUser, authError, loading, signUpWithEmail } = useAuthContext();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authUser) {
      router.replace('/');
    }
  }, [authUser, router]);

  const handleSignup = async () => {
    try {
      setSubmitting(true);
      await signUpWithEmail({ name, email, password });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandBlock}>
          <View style={styles.logoWrap}>
            <Image
              source={require('../assets/safewalk.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up once, then keep your contacts and safe word ready for every trip.</Text>
          </View>
        </View>

        <View style={styles.formCard}>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.gray[400]}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.gray[400]}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.gray[400]}
              secureTextEntry
            />
          </View>

          {authError ? (
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>{authError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!name || !email || !password || submitting || loading) && styles.buttonDisabled,
            ]}
            onPress={() => void handleSignup()}
            disabled={!name || !email || !password || submitting || loading}
          >
            {submitting
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.primaryButtonText}>Sign Up</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/login')} activeOpacity={0.5}>
            <Text style={styles.switchText}>
              Already have an account?{' '}
              <Text style={styles.switchLink}>Log in</Text>
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  content: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 32, paddingVertical: 32 },
  brandBlock: { alignItems: 'center', gap: 20 },
  brandText: { alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: colors.gray[100],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  title: { fontSize: 32, fontWeight: '800', color: colors.text, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textLight, lineHeight: 20, textAlign: 'center' },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    gap: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    shadowColor: colors.black,
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray[600],
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.gray[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[300],
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: colors.text,
  },
  errorRow: {
    backgroundColor: 'rgba(231,76,60,0.07)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '500' },
  primaryButton: {
    backgroundColor: '#111827',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: { color: colors.white, fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  switchText: { color: colors.gray[400], textAlign: 'center', fontSize: 14, fontWeight: '400' },
  switchLink: { color: colors.gray[600], fontWeight: '500', textDecorationLine: 'underline' },
  buttonDisabled: { backgroundColor: colors.gray[300], opacity: 0.7, shadowOpacity: 0 },
});
