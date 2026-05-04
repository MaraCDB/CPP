import { create } from 'zustand';
import type { ReminderTemplate } from '../types';
import { DEFAULT_TEMPLATES } from '../lib/reminders/templates';

const enq = async (kind: 'upsert_template' | 'delete_template', payload: unknown) => {
  const { enqueue } = await import('../lib/sync');
  void enqueue(kind, payload);
};

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
    DEFAULT_TEMPLATES.forEach(t => void enq('upsert_template', t));
  },
  upsert: (t) => {
    const exists = get().items.some(x => x.id === t.id);
    set({
      items: exists
        ? get().items.map(x => x.id === t.id ? t : x)
        : [...get().items, t],
    });
    void enq('upsert_template', t);
  },
  remove: (id) => {
    set({ items: get().items.filter(t => t.id !== id) });
    void enq('delete_template', { id });
  },
  toggleEnabled: (id) => {
    set({
      items: get().items.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t),
    });
    const updated = get().items.find(t => t.id === id);
    if (updated) void enq('upsert_template', updated);
  },
}));
