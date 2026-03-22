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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../services/firebase';
import type { EmergencyContact, UserProfile } from '../types';

const dangerWordKey = (uid: string) => `@safewalk/dangerWord/${uid}`;

async function cacheDangerWord(uid: string, word: string): Promise<void> {
  try {
    await AsyncStorage.setItem(dangerWordKey(uid), word);
  } catch {
    // cache write failure is non-fatal
  }
}

async function readCachedDangerWord(uid: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(dangerWordKey(uid));
  } catch {
    return null;
  }
}

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
  saveRecentSearch: (destination: string) => Promise<void>;
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

function buildProfile(user: User, safeWord?: string, recentSearches: string[] = []): UserProfile {
  return {
    uid: user.uid,
    name: user.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL,
    safeWord,
    recentSearches,
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

    const profileRef = doc(db, 'users', targetUid);
    const profileSnap = await getDoc(profileRef);
    const contactsSnap = await getDocs(collection(db, 'users', targetUid, 'emergencyContacts'));

    const fallbackUser = auth.currentUser;
    const safeWord = profileSnap.exists() ? (profileSnap.data().safeWord as string | undefined) : undefined;
    const recentSearches = profileSnap.exists()
      ? Array.isArray(profileSnap.data().recentSearches)
        ? (profileSnap.data().recentSearches as string[]).filter((search) => typeof search === 'string')
        : []
      : [];
    const nextProfile =
      profileSnap.exists() && fallbackUser
        ? {
            uid: targetUid,
            name: (profileSnap.data().name as string | undefined) || fallbackUser.displayName || '',
            email: (profileSnap.data().email as string | undefined) || fallbackUser.email || '',
            photoURL: (profileSnap.data().photoURL as string | undefined) || fallbackUser.photoURL,
            safeWord,
            recentSearches,
          }
        : fallbackUser
          ? buildProfile(fallbackUser, safeWord, recentSearches)
          : null;

    setProfile(nextProfile);
    setEmergencyContacts(
      contactsSnap.docs.map((contactDoc) => ({
        id: contactDoc.id,
        ...(contactDoc.data() as Omit<EmergencyContact, 'id'>),
      }))
    );

    // Keep AsyncStorage in sync so safeWord survives cold starts
    await cacheDangerWord(targetUid, nextProfile?.safeWord ?? '');
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

      // Optimistic pre-fill from local cache so UI is non-empty while Firestore loads
      const cached = await readCachedDangerWord(user.uid);
      if (cached) {
        setProfile(buildProfile(user, cached));
      }

      await refreshProfile(user.uid);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signUpWithEmail = async (input: { name: string; email: string; password: string }) => {
    try {
      setLoading(true);
      setAuthError(null);
      const result = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
      await updateProfile(result.user, { displayName: input.name.trim() });
      await setDoc(doc(db, 'users', result.user.uid), {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        photoURL: result.user.photoURL || null,
        safeWord: '',
        recentSearches: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await refreshProfile(result.user.uid);
    } catch (error) {
      setAuthError(mapAuthError(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (input: { email: string; password: string }) => {
    try {
      setLoading(true);
      setAuthError(null);
      const result = await signInWithEmailAndPassword(auth, input.email.trim(), input.password);
      await refreshProfile(result.user.uid);
    } catch (error) {
      setAuthError(mapAuthError(error));
      throw error;
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
    const nextName = input.name ?? profile?.name ?? auth.currentUser.displayName ?? '';
    const nextSafeWord = input.safeWord ?? profile?.safeWord ?? '';
    const nextPhotoUrl = input.photoURL ?? profile?.photoURL ?? auth.currentUser.photoURL ?? null;

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

    if (typeof input.name === 'string' && input.name !== auth.currentUser.displayName) {
      await updateProfile(auth.currentUser, { displayName: input.name });
    }

    await refreshProfile(auth.currentUser.uid);
  };

  const saveEmergencyContacts = async (contacts: EmergencyContact[]) => {
    if (!auth.currentUser) {
      return;
    }

    const batch = writeBatch(db);
    const contactsCollection = collection(db, 'users', auth.currentUser.uid, 'emergencyContacts');
    const existingContacts = await getDocs(contactsCollection);

    existingContacts.forEach((contactDoc) => batch.delete(contactDoc.ref));
    contacts.forEach((contact) => {
      const contactRef = doc(db, 'users', auth.currentUser!.uid, 'emergencyContacts', contact.id);
      batch.set(contactRef, {
        name: contact.name,
        phoneNumber: contact.phoneNumber,
        email: contact.email,
        relationship: contact.relationship || '',
        isPrimary: contact.isPrimary,
      });
    });

    await batch.commit();
    setEmergencyContacts(contacts);
  };

  const saveRecentSearch = async (destination: string) => {
    if (!auth.currentUser) {
      return;
    }

    const normalized = destination.trim();
    if (!normalized) {
      return;
    }

    const nextRecentSearches = [
      normalized,
      ...(profile?.recentSearches ?? []).filter(
        (search: string) => search.trim().toLowerCase() !== normalized.toLowerCase()
      ),
    ].slice(0, 2);

    await setDoc(
      doc(db, 'users', auth.currentUser.uid),
      {
        recentSearches: nextRecentSearches,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setProfile((prev) => (prev ? { ...prev, recentSearches: nextRecentSearches } : prev));
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
      saveRecentSearch,
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
