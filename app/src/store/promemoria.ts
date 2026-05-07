import { create } from 'zustand';
import type { Promemoria } from '../types';
import { uid } from '../lib/id';
import { upsertDoc, removeDoc } from '../lib/firebase/db';
import { auth } from '../lib/firebase/auth';

const getUid = (): string | null => auth.currentUser?.uid ?? null;

interface State {
  items: Promemoria[];
  add: (testo: string) => void;
  toggle: (id: string) => void;
  remove: (id: string) => void;
}

export const usePromemoria = create<State>((set, get) => ({
  items: [],
  add: (testo) => {
    const item: Promemoria = { id: uid('p'), testo, createdAt: new Date().toISOString(), done: false };
    set({ items: [...get().items, item] });
    const u = getUid();
    if (u) void upsertDoc(u, 'promemoria', item.id, item);
  },
  toggle: (id) => {
    set({ items: get().items.map(p => p.id === id ? { ...p, done: !p.done } : p) });
    const updated = get().items.find(p => p.id === id);
    if (updated) {
      const u = getUid();
      if (u) void upsertDoc(u, 'promemoria', updated.id, updated);
    }
  },
  remove: (id) => {
    set({ items: get().items.filter(p => p.id !== id) });
    const u = getUid();
    if (u) void removeDoc(u, 'promemoria', id);
  },
}));
