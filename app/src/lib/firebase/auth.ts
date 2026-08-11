import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut,
  onAuthStateChanged, setPersistence, indexedDBLocalPersistence,
  type User,
} from 'firebase/auth';
import { app } from './config';
import { useAuth } from '../../store/auth';
import {
  GOOGLE_API_SCOPES, clearGoogleToken, primeGoogleToken, setGoogleToken,
} from '../google/token';

export const auth = getAuth(app);
void setPersistence(auth, indexedDBLocalPersistence);

/** Durata assunta per l'access token del popup: Firebase non espone `expires_in`. */
const POPUP_TOKEN_TTL_S = 3600;

const provider = new GoogleAuthProvider();
GOOGLE_API_SCOPES.split(' ').forEach(s => provider.addScope(s));

const userToStore = (u: User) => ({
  email: u.email ?? '',
  name: u.displayName ?? '',
  picture: u.photoURL ?? undefined,
});

export const signIn = async (): Promise<void> => {
  const result = await signInWithPopup(auth, provider);
  const cred = GoogleAuthProvider.credentialFromResult(result);
  useAuth.setState({ user: userToStore(result.user) });
  if (cred?.accessToken) setGoogleToken(cred.accessToken, POPUP_TOKEN_TTL_S);
  else clearGoogleToken();
};

export const signOut = async (): Promise<void> => {
  await fbSignOut(auth);
  useAuth.setState({ user: null });
  clearGoogleToken();
};

export const initAuthListener = (): (() => void) =>
  onAuthStateChanged(auth, (u) => {
    if (u) {
      useAuth.setState({ user: userToStore(u) });
      // La sessione Firebase sopravvive al reload, l'access token Google no:
      // va riottenuto in silenzio, altrimenti Calendar/Drive/Contatti restano muti.
      void primeGoogleToken();
    } else {
      useAuth.setState({ user: null });
      clearGoogleToken();
    }
  });
