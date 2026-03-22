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
    } catch {
      // AuthContext sets the user-facing error state.
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
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up once, then keep your contacts and safe word ready for every trip.</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCorrect={false}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            autoCorrect={false}
          />

          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!name || !email || !password || submitting || loading) && styles.buttonDisabled,
            ]}
            onPress={() => void handleSignup()}
            disabled={!name || !email || !password || submitting || loading}
          >
            {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Sign Up</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/login')}>
            <Text style={styles.switchText}>Already have an account? Log in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF7ED' },
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
