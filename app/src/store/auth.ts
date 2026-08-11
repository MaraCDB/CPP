import { create } from 'zustand';
import type { GoogleUser } from '../types';

interface State {
  user: GoogleUser | null;
  googleAccessToken: string | null;
  /** Epoch ms di scadenza del token; null = scadenza sconosciuta. */
  googleTokenExpiresAt: number | null;
}

export const useAuth = create<State>(() => ({
  user: null,
  googleAccessToken: null,
  googleTokenExpiresAt: null,
}));
