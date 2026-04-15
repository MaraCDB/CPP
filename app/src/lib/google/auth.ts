import { useAuth } from '../../store/auth';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'openid', 'email', 'profile',
].join(' ');

declare global {
  interface Window { google?: any; }
}

let tokenClient: any = null;

export const initAuth = (): Promise<void> => new Promise((resolve) => {
  const check = () => {
    if (window.google?.accounts?.oauth2) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (resp: any) => {
          if (resp.error) return;
          const token = resp.access_token;
          const expiresIn = Number(resp.expires_in) || 3600;
          const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const info = await r.json();
          useAuth.getState().setSession(
            { email: info.email, name: info.name, picture: info.picture },
            token, expiresIn,
          );
        },
      });
      resolve();
    } else setTimeout(check, 50);
  };
  check();
});

export const signIn = () => tokenClient?.requestAccessToken({ prompt: 'consent' });
export const silentRefresh = () => tokenClient?.requestAccessToken({ prompt: '' });

export const startTokenAutoRefresh = () => {
  setInterval(() => {
    const { accessToken, tokenExpiry } = useAuth.getState();
    if (accessToken && tokenExpiry - Date.now() < 5 * 60 * 1000) silentRefresh();
  }, 60 * 1000);
};
