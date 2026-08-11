import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuth } from '../../../src/store/auth';
import {
  GoogleAuthError,
  getGoogleAccessToken,
  googleFetch,
  setGoogleToken,
  clearGoogleToken,
  GIS_SRC,
} from '../../../src/lib/google/token';

interface FakeTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  hint?: string;
  callback: (r: FakeTokenResponse) => void;
  error_callback?: (e: unknown) => void;
}

let responses: FakeTokenResponse[];
let requestCalls: { prompt: string }[];
let initTokenClient: ReturnType<typeof vi.fn>;
let lastConfig: TokenClientConfig | null;

const installGis = (): void => {
  initTokenClient = vi.fn((cfg: TokenClientConfig) => {
    lastConfig = cfg;
    return {
      requestAccessToken: (opts: { prompt: string }) => {
        requestCalls.push(opts);
        const r = responses.shift() ?? { error: 'no_response_queued' };
        queueMicrotask(() => cfg.callback(r));
      },
    };
  });
  (window as unknown as { google: unknown }).google = {
    accounts: { oauth2: { initTokenClient } },
  };
};

const removeGis = (): void => {
  delete (window as unknown as { google?: unknown }).google;
};

const IN_30_MIN = () => Date.now() + 30 * 60_000;

beforeEach(() => {
  responses = [];
  requestCalls = [];
  lastConfig = null;
  installGis();
  clearGoogleToken();
  useAuth.setState({ user: null });
  document.querySelectorAll(`script[src="${GIS_SRC}"]`).forEach(s => s.remove());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getGoogleAccessToken', () => {
  it('restituisce il token in cache senza contattare GIS se è lontano dalla scadenza', async () => {
    setGoogleToken('cached', 3600);

    await expect(getGoogleAccessToken()).resolves.toBe('cached');
    expect(initTokenClient).not.toHaveBeenCalled();
  });

  it('chiede a GIS un token silenzioso quando lo store è vuoto', async () => {
    responses = [{ access_token: 'fresh', expires_in: 3600 }];

    await expect(getGoogleAccessToken()).resolves.toBe('fresh');
    expect(requestCalls).toEqual([{ prompt: '' }]);
    expect(useAuth.getState().googleAccessToken).toBe('fresh');
    expect(useAuth.getState().googleTokenExpiresAt).toBeGreaterThan(Date.now());
  });

  it('passa lo hint con l’email dell’utente per evitare il selettore account', async () => {
    useAuth.setState({ user: { email: 'a@b.com', name: 'A' } });
    responses = [{ access_token: 'fresh', expires_in: 3600 }];

    await getGoogleAccessToken();

    expect(lastConfig?.hint).toBe('a@b.com');
  });

  it('rinnova il token quando è già dentro la finestra di scadenza', async () => {
    setGoogleToken('stale', 60);
    responses = [{ access_token: 'fresh', expires_in: 3600 }];

    await expect(getGoogleAccessToken()).resolves.toBe('fresh');
  });

  it('deduplica le richieste concorrenti in una sola chiamata a GIS', async () => {
    responses = [{ access_token: 'fresh', expires_in: 3600 }];

    const [a, b] = await Promise.all([getGoogleAccessToken(), getGoogleAccessToken()]);

    expect(a).toBe('fresh');
    expect(b).toBe('fresh');
    expect(requestCalls).toHaveLength(1);
  });

  it('lancia GoogleAuthError quando GIS risponde con un errore', async () => {
    responses = [{ error: 'interaction_required' }];

    await expect(getGoogleAccessToken()).rejects.toBeInstanceOf(GoogleAuthError);
    expect(useAuth.getState().googleAccessToken).toBeNull();
  });

  it('lancia GoogleAuthError quando GIS invoca error_callback', async () => {
    (window as unknown as { google: { accounts: { oauth2: { initTokenClient: unknown } } } })
      .google.accounts.oauth2.initTokenClient = (cfg: TokenClientConfig) => ({
        requestAccessToken: () => {
          queueMicrotask(() => cfg.error_callback?.({ type: 'popup_failed_to_open' }));
        },
      });

    await expect(getGoogleAccessToken()).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it('carica lo script GIS se non è ancora presente nella pagina', async () => {
    removeGis();
    responses = [{ access_token: 'fresh', expires_in: 3600 }];

    const pending = getGoogleAccessToken();
    const el = document.querySelector(`script[src="${GIS_SRC}"]`) as HTMLScriptElement | null;
    expect(el).not.toBeNull();

    installGis();
    el?.dispatchEvent(new Event('load'));

    await expect(pending).resolves.toBe('fresh');
  });
});

describe('googleFetch', () => {
  it('aggiunge l’header Authorization con il token corrente', async () => {
    setGoogleToken('cached', 3600);
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await googleFetch('https://api.test/x');

    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBe('Bearer cached');
  });

  it('preserva gli header passati dal chiamante', async () => {
    setGoogleToken('cached', 3600);
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await googleFetch('https://api.test/x', { headers: { 'Content-Type': 'application/json' } });

    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.Authorization).toBe('Bearer cached');
  });

  it('riprova una volta con un token fresco dopo un 401', async () => {
    useAuth.setState({ googleAccessToken: 'stale', googleTokenExpiresAt: IN_30_MIN() });
    responses = [{ access_token: 'fresh', expires_in: 3600 }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await googleFetch('https://api.test/x');

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryInit = fetchMock.mock.calls[1][1] as { headers: Record<string, string> };
    expect(retryInit.headers.Authorization).toBe('Bearer fresh');
  });

  it('restituisce la risposta 401 originale se il refresh silenzioso fallisce', async () => {
    useAuth.setState({ googleAccessToken: 'stale', googleTokenExpiresAt: IN_30_MIN() });
    responses = [{ error: 'interaction_required' }];
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await googleFetch('https://api.test/x');

    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('non riprova su una risposta di successo', async () => {
    setGoogleToken('cached', 3600);
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await googleFetch('https://api.test/x');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(initTokenClient).not.toHaveBeenCalled();
  });

  it('lancia GoogleAuthError se non riesce a ottenere alcun token', async () => {
    responses = [{ error: 'interaction_required' }];
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(googleFetch('https://api.test/x')).rejects.toBeInstanceOf(GoogleAuthError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('setGoogleToken / clearGoogleToken', () => {
  it('setGoogleToken salva token e scadenza calcolata', () => {
    setGoogleToken('t', 3600);

    const { googleAccessToken, googleTokenExpiresAt } = useAuth.getState();
    expect(googleAccessToken).toBe('t');
    expect(googleTokenExpiresAt).toBeGreaterThan(Date.now() + 3500_000);
  });

  it('clearGoogleToken azzera token e scadenza', () => {
    setGoogleToken('t', 3600);

    clearGoogleToken();

    expect(useAuth.getState().googleAccessToken).toBeNull();
    expect(useAuth.getState().googleTokenExpiresAt).toBeNull();
  });
});
