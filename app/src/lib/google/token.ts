import { useAuth } from '../../store/auth';

/**
 * Gestione degli access token Google per le API REST (Calendar, Drive, People).
 *
 * Firebase Auth restituisce l'access token OAuth una sola volta, nel risultato del
 * popup di login, e non lo rinnova né lo ripristina al reload. Questo modulo colma
 * il buco usando Google Identity Services (GIS) per ottenere token silenziosamente
 * (`prompt: ''`), sfruttando il consenso già concesso.
 */

export const GIS_SRC = 'https://accounts.google.com/gsi/client';

export const GOOGLE_API_SCOPES = [
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

/** Margine di sicurezza: un token che scade entro questo lasso è già da rinnovare. */
const EXPIRY_SKEW_MS = 5 * 60_000;
const GIS_LOAD_TIMEOUT_MS = 10_000;
const DEFAULT_EXPIRES_IN_S = 3600;

export class GoogleAuthError extends Error {
  constructor(msg = 'Impossibile ottenere un token Google') {
    super(msg);
    this.name = 'GoogleAuthError';
  }
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (opts: { prompt: string }) => void;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  hint?: string;
  callback: (r: TokenResponse) => void;
  error_callback?: (e: unknown) => void;
}

interface GoogleOAuth2 {
  initTokenClient: (cfg: TokenClientConfig) => TokenClient;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

export const setGoogleToken = (accessToken: string, expiresInSeconds: number): void => {
  useAuth.setState({
    googleAccessToken: accessToken,
    googleTokenExpiresAt: Date.now() + expiresInSeconds * 1000,
  });
};

export const clearGoogleToken = (): void => {
  useAuth.setState({ googleAccessToken: null, googleTokenExpiresAt: null });
};

/** Token in store ancora utilizzabile, oppure null se assente o troppo vicino alla scadenza. */
const cachedToken = (): string | null => {
  const { googleAccessToken, googleTokenExpiresAt } = useAuth.getState();
  if (!googleAccessToken) return null;
  if (googleTokenExpiresAt !== null && googleTokenExpiresAt - Date.now() <= EXPIRY_SKEW_MS) return null;
  return googleAccessToken;
};

const loadGis = (): Promise<GoogleOAuth2> => {
  const already = window.google?.accounts?.oauth2;
  if (already) return Promise.resolve(already);

  return new Promise<GoogleOAuth2>((resolve, reject) => {
    const el = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
      ?? Object.assign(document.createElement('script'), { src: GIS_SRC, async: true, defer: true });

    const onLoad = () => {
      cleanup();
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) resolve(oauth2);
      else reject(new GoogleAuthError('Google Identity Services caricato ma non disponibile'));
    };
    const onError = () => {
      cleanup();
      reject(new GoogleAuthError('Caricamento di Google Identity Services fallito'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new GoogleAuthError('Timeout nel caricamento di Google Identity Services'));
    }, GIS_LOAD_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timer);
      el.removeEventListener('load', onLoad);
      el.removeEventListener('error', onError);
    };

    el.addEventListener('load', onLoad);
    el.addEventListener('error', onError);
    if (!el.isConnected) document.head.appendChild(el);
  });
};

/** Richiesta in volo, condivisa fra chiamanti concorrenti per non aprire N flussi GIS. */
let pending: Promise<string> | null = null;

const requestSilentToken = (): Promise<string> => {
  if (pending) return pending;

  pending = (async (): Promise<string> => {
    if (!CLIENT_ID) throw new GoogleAuthError('VITE_GOOGLE_CLIENT_ID non configurato');
    const oauth2 = await loadGis();

    return new Promise<string>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: GOOGLE_API_SCOPES,
        hint: useAuth.getState().user?.email || undefined,
        callback: (r) => {
          if (r.error || !r.access_token) {
            reject(new GoogleAuthError(r.error ?? 'Nessun access token restituito da GIS'));
            return;
          }
          const expiresIn = Number(r.expires_in) || DEFAULT_EXPIRES_IN_S;
          setGoogleToken(r.access_token, expiresIn);
          resolve(r.access_token);
        },
        error_callback: () => reject(new GoogleAuthError('Richiesta token Google interrotta')),
      });
      client.requestAccessToken({ prompt: '' });
    });
  })().finally(() => { pending = null; });

  return pending;
};

/** Token valido per le Google API: dalla cache se fresco, altrimenti rinnovato via GIS. */
export const getGoogleAccessToken = async (): Promise<string> => {
  const cached = cachedToken();
  if (cached) return cached;
  return requestSilentToken();
};

/**
 * Prova a procurarsi un token all'avvio senza disturbare l'utente.
 * Se fallisce resta il bottone "Riconnetti Google" come fallback esplicito.
 */
export const primeGoogleToken = async (): Promise<void> => {
  try {
    await getGoogleAccessToken();
  } catch {
    /* silenzioso per scelta: nessun popup non richiesto all'avvio */
  }
};

const withAuth = (init: RequestInit, accessToken: string): RequestInit => ({
  ...init,
  headers: {
    ...(init.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${accessToken}`,
  },
});

/**
 * `fetch` verso le Google API con Authorization automatico e un solo retry su
 * 401/403 con token appena rinnovato (copre la scadenza che sfugge allo skew).
 */
export const googleFetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const accessToken = await getGoogleAccessToken();
  const res = await fetch(url, withAuth(init, accessToken));
  if (res.status !== 401 && res.status !== 403) return res;

  clearGoogleToken();
  let fresh: string;
  try {
    fresh = await requestSilentToken();
  } catch {
    return res;
  }
  return fetch(url, withAuth(init, fresh));
};
