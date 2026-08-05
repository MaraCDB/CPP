import { create } from 'zustand';
import { updateUserSettings } from '../lib/firebase/db';
import { auth } from '../lib/firebase/auth';

const getUid = (): string | null => auth.currentUser?.uid ?? null;

interface State {
  googleCalendarId: string | null;
  googleCalendarName: string | null;
  calendarSyncEnabled: boolean;
  setCalendar: (id: string, name: string) => void;
  setEnabled: (enabled: boolean) => void;
  disconnect: () => void;
}

export const useCalendarSettings = create<State>((set) => ({
  googleCalendarId: null,
  googleCalendarName: null,
  calendarSyncEnabled: false,
  setCalendar: (id, name) => {
    set({ googleCalendarId: id, googleCalendarName: name, calendarSyncEnabled: true });
    const u = getUid();
    if (u) void updateUserSettings(u, { googleCalendarId: id, googleCalendarName: name, calendarSyncEnabled: true });
  },
  setEnabled: (enabled) => {
    set({ calendarSyncEnabled: enabled });
    const u = getUid();
    if (u) void updateUserSettings(u, { calendarSyncEnabled: enabled });
  },
  disconnect: () => {
    set({ googleCalendarId: null, googleCalendarName: null, calendarSyncEnabled: false });
    const u = getUid();
    if (u) void updateUserSettings(u, { googleCalendarId: null, googleCalendarName: null, calendarSyncEnabled: false });
  },
}));
