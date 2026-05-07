import { create } from 'zustand';
import type { ReminderTemplate } from '../types';
import { DEFAULT_TEMPLATES } from '../lib/reminders/templates';
import { upsertDoc, removeDoc } from '../lib/firebase/db';
import { auth } from '../lib/firebase/auth';

const getUid = (): string | null => auth.currentUser?.uid ?? null;

interface State {
  items: ReminderTemplate[];
  seedDefaults: () => void;
  upsert: (t: ReminderTemplate) => void;
  remove: (id: string) => void;
  toggleEnabled: (id: string) => void;
}

export const useTemplates = create<State>((set, get) => ({
  items: [],
  seedDefaults: () => {
    if (get().items.length > 0) return;
    set({ items: [...DEFAULT_TEMPLATES] });
    const u = getUid();
    if (u) DEFAULT_TEMPLATES.forEach(t => void upsertDoc(u, 'templates', t.id, t));
  },
  upsert: (t) => {
    const exists = get().items.some(x => x.id === t.id);
    set({
      items: exists
        ? get().items.map(x => x.id === t.id ? t : x)
        : [...get().items, t],
    });
    const u = getUid();
    if (u) void upsertDoc(u, 'templates', t.id, t);
  },
  remove: (id) => {
    set({ items: get().items.filter(t => t.id !== id) });
    const u = getUid();
    if (u) void removeDoc(u, 'templates', id);
  },
  toggleEnabled: (id) => {
    set({
      items: get().items.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t),
    });
    const updated = get().items.find(t => t.id === id);
    if (updated) {
      const u = getUid();
      if (u) void upsertDoc(u, 'templates', updated.id, updated);
    }
  },
}));
