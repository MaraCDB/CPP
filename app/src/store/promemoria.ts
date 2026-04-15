import { create } from 'zustand';
import type { Promemoria } from '../types';
import { uid } from '../lib/id';

const enq = async (kind: 'upsert_promemoria' | 'delete_promemoria', payload: unknown) => {
  const { enqueue } = await import('../lib/sync');
  void enqueue(kind, payload);
};

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
    void enq('upsert_promemoria', item);
  },
  toggle: (id) => {
    set({ items: get().items.map(p => p.id === id ? { ...p, done: !p.done } : p) });
    const updated = get().items.find(p => p.id === id);
    if (updated) void enq('upsert_promemoria', updated);
  },
  remove: (id) => {
    set({ items: get().items.filter(p => p.id !== id) });
    void enq('delete_promemoria', { id });
  },
}));
