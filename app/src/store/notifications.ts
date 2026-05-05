import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface State {
  permission: 'default' | 'granted' | 'denied';
  bannerDismissed: boolean;
  setPermission: (p: 'default' | 'granted' | 'denied') => void;
  dismissBanner: () => void;
}

export const useNotificationsStore = create<State>()(
  persist(
    (set) => ({
      permission: 'default',
      bannerDismissed: false,
      setPermission: (p) => set({ permission: p }),
      dismissBanner: () => set({ bannerDismissed: true }),
    }),
    { name: 'cdb_notifications' },
  ),
);
