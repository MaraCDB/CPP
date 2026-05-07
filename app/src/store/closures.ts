import { create } from 'zustand';
import type { Chiusura } from '../types';
import { uid } from '../lib/id';
import { upsertDoc, removeDoc } from '../lib/firebase/db';
import { auth } from '../lib/firebase/auth';

const getUid = (): string | null => auth.currentUser?.uid ?? null;

interface State {
  items: Chiusura[];
  add: (c: Omit<Chiusura, 'id'>) => Chiusura;
  update: (id: string, patch: Partial<Chiusura>) => void;
  remove: (id: string) => void;
}

export const useClosures = create<State>((set, get) => ({
  items: [],
  add: (c) => {
    const item: Chiusura = { ...c, id: uid('c') };
    set({ items: [...get().items, item] });
    const u = getUid();
    if (u) void upsertDoc(u, 'closures', item.id, item);
    return item;
  },
  update: (id, patch) => {
    set({ items: get().items.map(c => c.id === id ? { ...c, ...patch } : c) });
    const updated = get().items.find(c => c.id === id);
    if (updated) {
      const u = getUid();
      if (u) void upsertDoc(u, 'closures', updated.id, updated);
    }
  },
  remove: (id) => {
    set({ items: get().items.filter(c => c.id !== id) });
    const u = getUid();
    if (u) void removeDoc(u, 'closures', id);
  },
}));
