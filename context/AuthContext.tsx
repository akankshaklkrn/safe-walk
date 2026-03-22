import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import {
  AuthError,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import type { EmergencyContact, UserProfile } from '../types';

interface AuthContextValue {
  authUser: User | null;
  profile: UserProfile | null;
  emergencyContacts: EmergencyContact[];
  loading: boolean;
  authError: string | null;
  signUpWithEmail: (input: { name: string; email: string; password: string }) => Promise<void>;
  loginWithEmail: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  saveProfile: (input: Partial<Pick<UserProfile, 'name' | 'safeWord' | 'photoURL'>>) => Promise<void>;
  saveEmergencyContacts: (contacts: EmergencyContact[]) => Promise<void>;
  refreshProfile: (uid?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Something went wrong. Please try again.';
  }

  const code = (error as AuthError).code;
  switch (code) {
    case 'auth/email-already-in-use':
      return 'That email is already in use.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Invalid email or password.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    default:
      return error.message || 'Something went wrong. Please try again.';
  }
}

function mapFirestoreError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'We could not sync your profile right now. Please try again.';
  }

  const code = (error as { code?: string }).code;
  switch (code) {
    case 'permission-denied':
      return 'Your account does not have permission to access this data yet. Check your Firebase rules.';
    case 'unavailable':
      return 'Firebase is temporarily unavailable. Please try again.';
    default:
      return error.message || 'We could not sync your profile right now. Please try again.';
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateSignupInput(input: { name: string; email: string; password: string }) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);

  if (name.length < 2) {
    return 'Enter your full name.';
  }

  if (!isValidEmail(email)) {
    return 'Enter a valid email address.';
  }

  if (input.password.trim().length < 6) {
    return 'Password should be at least 6 characters.';
  }

  return null;
}

function validateLoginInput(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);

  if (!isValidEmail(email)) {
    return 'Enter a valid email address.';
  }

  if (!input.password.trim()) {
    return 'Enter your password.';
  }

  return null;
}

function validateSafeWord(safeWord: string) {
  const normalized = safeWord.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length < 2) {
    return 'Safe word should be at least 2 characters.';
  }

  if (normalized.length > 40) {
    return 'Safe word should be 40 characters or fewer.';
  }

  return null;
}

function validateContacts(contacts: EmergencyContact[]) {
  if (contacts.length === 0) {
    return 'Add at least one emergency contact.';
  }

  const primaryContacts = contacts.filter((contact) => contact.isPrimary);
  if (primaryContacts.length !== 1) {
    return 'Select exactly one primary emergency contact.';
  }

  for (const contact of contacts) {
    if (contact.name.trim().length < 2) {
      return 'Each emergency contact needs a valid name.';
    }

    if (!isValidEmail(contact.email.trim().toLowerCase())) {
      return 'Each emergency contact needs a valid email address.';
    }

    if (!/^\+?[\d\s\-()]{7,}$/.test(contact.phoneNumber.trim())) {
      return 'Each emergency contact needs a valid phone number.';
    }
  }

  return null;
}

function buildProfile(user: User, safeWord?: string): UserProfile {
  return {
    uid: user.uid,
    name: user.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL,
    safeWord,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshProfile = async (uid?: string) => {
    const targetUid = uid ?? auth.currentUser?.uid;

    if (!targetUid) {
      setProfile(null);
      setEmergencyContacts([]);
      return;
    }

    const fallbackUser = auth.currentUser;
    try {
      const profileRef = doc(db, 'users', targetUid);
      const profileSnap = await getDoc(profileRef);
      const contactsSnap = await getDocs(collection(db, 'users', targetUid, 'emergencyContacts'));
      const safeWord = profileSnap.exists() ? (profileSnap.data().safeWord as string | undefined) : undefined;
      const nextProfile =
        profileSnap.exists() && fallbackUser
          ? {
              uid: targetUid,
              name: (profileSnap.data().name as string | undefined) || fallbackUser.displayName || '',
              email: (profileSnap.data().email as string | undefined) || fallbackUser.email || '',
              photoURL: (profileSnap.data().photoURL as string | undefined) || fallbackUser.photoURL,
              safeWord,
            }
          : fallbackUser
            ? buildProfile(fallbackUser, safeWord)
            : null;

      setProfile(nextProfile);
      setEmergencyContacts(
        contactsSnap.docs.map((contactDoc) => ({
          id: contactDoc.id,
          ...(contactDoc.data() as Omit<EmergencyContact, 'id'>),
        }))
      );
    } catch (error) {
      setAuthError(mapFirestoreError(error));
      setProfile(fallbackUser ? buildProfile(fallbackUser) : null);
      setEmergencyContacts([]);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);

      if (!user) {
        setProfile(null);
        setEmergencyContacts([]);
        setLoading(false);
        return;
      }

      await refreshProfile(user.uid);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signUpWithEmail = async (input: { name: string; email: string; password: string }) => {
    const validationError = validateSignupInput(input);
    if (validationError) {
      setAuthError(validationError);
      return;
    }

    try {
      setLoading(true);
      setAuthError(null);
      const email = normalizeEmail(input.email);
      const name = input.name.trim();
      const result = await createUserWithEmailAndPassword(auth, email, input.password.trim());
      await updateProfile(result.user, { displayName: name });
      await setDoc(doc(db, 'users', result.user.uid), {
        name,
        email,
        photoURL: result.user.photoURL || null,
        safeWord: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await refreshProfile(result.user.uid);
    } catch (error) {
      setAuthError(mapAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (input: { email: string; password: string }) => {
    const validationError = validateLoginInput(input);
    if (validationError) {
      setAuthError(validationError);
      return;
    }

    try {
      setLoading(true);
      setAuthError(null);
      const result = await signInWithEmailAndPassword(
        auth,
        normalizeEmail(input.email),
        input.password.trim()
      );
      await refreshProfile(result.user.uid);
    } catch (error) {
      setAuthError(mapAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const saveProfile = async (
    input: Partial<Pick<UserProfile, 'name' | 'safeWord' | 'photoURL'>>
  ) => {
    if (!auth.currentUser) {
      return;
    }

    const userRef = doc(db, 'users', auth.currentUser.uid);
    const nextName = (input.name ?? profile?.name ?? auth.currentUser.displayName ?? '').trim();
    const nextSafeWord = (input.safeWord ?? profile?.safeWord ?? '').trim();
    const nextPhotoUrl = input.photoURL ?? profile?.photoURL ?? auth.currentUser.photoURL ?? null;

    if (typeof input.name === 'string' && nextName.length < 2) {
      setAuthError('Name should be at least 2 characters.');
      return;
    }

    const safeWordError = validateSafeWord(nextSafeWord);
    if (safeWordError) {
      setAuthError(safeWordError);
      return;
    }

    try {
      setAuthError(null);
      await setDoc(
        userRef,
        {
          name: nextName,
          email: auth.currentUser.email || profile?.email || '',
          photoURL: nextPhotoUrl,
          safeWord: nextSafeWord,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (typeof input.name === 'string' && nextName !== auth.currentUser.displayName) {
        await updateProfile(auth.currentUser, { displayName: nextName });
      }

      await refreshProfile(auth.currentUser.uid);
    } catch (error) {
      setAuthError(mapFirestoreError(error));
    }
  };

  const saveEmergencyContacts = async (contacts: EmergencyContact[]) => {
    if (!auth.currentUser) {
      return;
    }

    const validationError = validateContacts(contacts);
    if (validationError) {
      setAuthError(validationError);
      return;
    }

    try {
      setAuthError(null);
      const batch = writeBatch(db);
      const contactsCollection = collection(db, 'users', auth.currentUser.uid, 'emergencyContacts');
      const existingContacts = await getDocs(contactsCollection);

      existingContacts.forEach((contactDoc) => batch.delete(contactDoc.ref));
      contacts.forEach((contact) => {
        const contactRef = doc(db, 'users', auth.currentUser!.uid, 'emergencyContacts', contact.id);
        batch.set(contactRef, {
          name: contact.name.trim(),
          phoneNumber: contact.phoneNumber.trim(),
          email: normalizeEmail(contact.email),
          relationship: contact.relationship?.trim() || '',
          isPrimary: contact.isPrimary,
        });
      });

      await batch.commit();
      setEmergencyContacts(contacts.map((contact) => ({
        ...contact,
        name: contact.name.trim(),
        phoneNumber: contact.phoneNumber.trim(),
        email: normalizeEmail(contact.email),
        relationship: contact.relationship?.trim() || undefined,
      })));
    } catch (error) {
      setAuthError(mapFirestoreError(error));
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      authUser,
      profile,
      emergencyContacts,
      loading,
      authError,
      signUpWithEmail,
      loginWithEmail,
      logout,
      saveProfile,
      saveEmergencyContacts,
      refreshProfile,
    }),
    [authUser, profile, emergencyContacts, loading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}
