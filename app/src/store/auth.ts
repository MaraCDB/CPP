import { create } from 'zustand';
import type { GoogleUser } from '../types';

interface State {
  user: GoogleUser | null;
  googleAccessToken: string | null;
}

export const useAuth = create<State>(() => ({
  user: null,
  googleAccessToken: null,
}));
