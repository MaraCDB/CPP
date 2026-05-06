import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GoogleUser } from '../types';

interface State {
  user: GoogleUser | null;
  accessToken: string | null;
  tokenExpiry: number;
  readonly: boolean;
  setSession: (user: GoogleUser, token: string, expiresIn: number) => void;
  setReadonly: (v: boolean) => void;
  signOut: () => void;
}

export const useAuth = create<State>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      tokenExpiry: 0,
      readonly: false,
      setSession: (user, accessToken, expiresIn) => set({
        user, accessToken, tokenExpiry: Date.now() + expiresIn * 1000,
      }),
      setReadonly: (readonly) => set({ readonly }),
      signOut: () => set({ user: null, accessToken: null, tokenExpiry: 0, readonly: false }),
    }),
    {
      name: 'cpp-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
