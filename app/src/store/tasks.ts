import { create } from 'zustand';
import type { BookingTask } from '../types';
import { idbSet } from '../lib/idb';

const enq = async (kind: 'upsert_task' | 'delete_task', payload: unknown) => {
  const { enqueue } = await import('../lib/sync');
  void enqueue(kind, payload);
};

const mirrorAll = (items: BookingTask[]) => { void idbSet('tasks', 'all', items); };

interface State {
  items: BookingTask[];
  add: (task: BookingTask) => void;
  addMany: (tasks: BookingTask[]) => void;
  update: (id: string, patch: Partial<BookingTask>) => void;
  toggleDone: (id: string) => void;
  remove: (id: string) => void;
  removeByBooking: (bookingId: string) => void;
  byBooking: (bookingId: string) => BookingTask[];
}

export const useTasks = create<State>((set, get) => ({
  items: [],
  add: (task) => {
    set({ items: [...get().items, task] });
    mirrorAll(get().items);
    void enq('upsert_task', task);
  },
  addMany: (tasks) => {
    set({ items: [...get().items, ...tasks] });
    mirrorAll(get().items);
    tasks.forEach(t => void enq('upsert_task', t));
  },
  update: (id, patch) => {
    set({
      items: get().items.map(t =>
        t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
      ),
    });
    mirrorAll(get().items);
    const updated = get().items.find(t => t.id === id);
    if (updated) void enq('upsert_task', updated);
  },
  toggleDone: (id) => {
    const now = new Date().toISOString();
    set({
      items: get().items.map(t =>
        t.id === id
          ? { ...t, done: !t.done, doneAt: !t.done ? now : undefined, updatedAt: now }
          : t,
      ),
    });
    mirrorAll(get().items);
    const updated = get().items.find(t => t.id === id);
    if (updated) void enq('upsert_task', updated);
  },
  remove: (id) => {
    const now = new Date().toISOString();
    set({
      items: get().items.map(t => t.id === id ? { ...t, deletedAt: now, updatedAt: now } : t),
    });
    mirrorAll(get().items);
    void enq('delete_task', { id });
  },
  removeByBooking: (bookingId) => {
    const now = new Date().toISOString();
    set({
      items: get().items.map(t =>
        t.bookingId === bookingId && !t.deletedAt
          ? { ...t, deletedAt: now, updatedAt: now }
          : t,
      ),
    });
    mirrorAll(get().items);
    get().items.filter(t => t.bookingId === bookingId).forEach(t => void enq('upsert_task', t));
  },
  byBooking: (bookingId) =>
    get().items.filter(t => t.bookingId === bookingId && !t.deletedAt),
}));
