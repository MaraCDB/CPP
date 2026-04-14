import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Promemoria } from '../types';
import { uid } from '../lib/id';

interface State {
  items: Promemoria[];
  add: (testo: string) => void;
  toggle: (id: string) => void;
  remove: (id: string) => void;
}

export const usePromemoria = create<State>()(persist((set, get) => ({
  items: [],
  add: (testo) => set({
    items: [...get().items, { id: uid('p'), testo, createdAt: new Date().toISOString(), done: false }],
  }),
  toggle: (id) => set({ items: get().items.map(p => p.id === id ? { ...p, done: !p.done } : p) }),
  remove: (id) => set({ items: get().items.filter(p => p.id !== id) }),
}), { name: 'cdb_promemoria_v1' }));
