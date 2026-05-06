import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut,
  onAuthStateChanged, setPersistence, indexedDBLocalPersistence,
  type User,
} from 'firebase/auth';
import { app } from './config';
import { useAuth } from '../../store/auth';

export const auth = getAuth(app);
void setPersistence(auth, indexedDBLocalPersistence);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/contacts');
provider.addScope('https://www.googleapis.com/auth/drive.file');

const userToStore = (u: User) => ({
  email: u.email ?? '',
  name: u.displayName ?? '',
  picture: u.photoURL ?? undefined,
});

export const signIn = async (): Promise<void> => {
  const result = await signInWithPopup(auth, provider);
  const cred = GoogleAuthProvider.credentialFromResult(result);
  (useAuth.setState as (s: Record<string, unknown>) => void)({
    user: userToStore(result.user),
    googleAccessToken: cred?.accessToken ?? null,
  });
};

export const signOut = async (): Promise<void> => {
  await fbSignOut(auth);
  (useAuth.setState as (s: Record<string, unknown>) => void)({ user: null, googleAccessToken: null });
};

export const initAuthListener = (): (() => void) =>
  onAuthStateChanged(auth, (u) => {
    if (u) {
      (useAuth.setState as (s: Record<string, unknown>) => void)({ user: userToStore(u) });
    } else {
      (useAuth.setState as (s: Record<string, unknown>) => void)({ user: null, googleAccessToken: null });
    }
  });
