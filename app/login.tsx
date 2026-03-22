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

export default function LoginScreen() {
  const router = useRouter();
  const { authUser, authError, loading, loginWithEmail } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authUser) {
      router.replace('/');
    }
  }, [authUser, router]);

  const handleLogin = async () => {
    try {
      setSubmitting(true);
      await loginWithEmail({ email, password });
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
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandBlock}>
          <Image
            source={require('../assets/safewalk.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>SafeWalk keeps your companion, profile, and safety setup in sync.</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
          />

          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, (!email || !password || submitting || loading) && styles.buttonDisabled]}
            onPress={() => void handleLogin()}
            disabled={!email || !password || submitting || loading}
          >
            {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Log In</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/signup')}>
            <Text style={styles.switchText}>New to SafeWalk? Create an account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF5FF' },
  content: { flexGrow: 1, paddingHorizontal: 24, gap: 24, paddingTop: 56, paddingBottom: 48 },
  brandBlock: { gap: 10, alignItems: 'center' },
  logoImage: {
    width: 132,
    height: 132,
  },
  title: { fontSize: 34, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.textLight, lineHeight: 22, textAlign: 'center' },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: colors.black,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  label: { fontSize: 14, fontWeight: '700', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  errorText: { color: colors.danger, fontSize: 14 },
  primaryButton: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  switchText: { color: colors.primary, textAlign: 'center', fontWeight: '700', marginTop: 4 },
  buttonDisabled: { opacity: 0.55 },
});
