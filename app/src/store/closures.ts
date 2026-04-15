import { create } from 'zustand';
import type { Chiusura } from '../types';
import { uid } from '../lib/id';

const enq = async (kind: 'upsert_closure' | 'delete_closure', payload: unknown) => {
  const { enqueue } = await import('../lib/sync');
  void enqueue(kind, payload);
};

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
    void enq('upsert_closure', item);
    return item;
  },
  update: (id, patch) => {
    set({ items: get().items.map(c => c.id === id ? { ...c, ...patch } : c) });
    const updated = get().items.find(c => c.id === id);
    if (updated) void enq('upsert_closure', updated);
  },
  remove: (id) => {
    set({ items: get().items.filter(c => c.id !== id) });
    void enq('delete_closure', { id });
  },
}));
