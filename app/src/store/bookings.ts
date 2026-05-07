import { create } from 'zustand';
import type { Prenotazione } from '../types';
import { uid } from '../lib/id';
import { upsertDoc, removeDoc } from '../lib/firebase/db';
import { auth } from '../lib/firebase/auth';

const getUid = (): string | null => auth.currentUser?.uid ?? null;

const onBookingCreated = async (booking: Prenotazione) => {
  const { useTemplates } = await import('./templates');
  const { useTasks } = await import('./tasks');
  const { materializeTasks } = await import('../lib/reminders/materialize');
  const templates = useTemplates.getState().items;
  if (templates.length === 0) return;
  const tasks = materializeTasks(booking, templates);
  useTasks.getState().addMany(tasks);
};

const onBookingUpdated = async (oldB: Prenotazione, newB: Prenotazione) => {
  if (oldB.checkin === newB.checkin && oldB.checkout === newB.checkout && oldB.numOspiti === newB.numOspiti) return;
  const { useTemplates } = await import('./templates');
  const { useTasks } = await import('./tasks');
  const { recalculateDueAt } = await import('../lib/reminders/materialize');
  const templates = useTemplates.getState().items;
  const tasks = useTasks.getState().byBooking(newB.id);
  tasks.forEach(t => {
    if (t.templateId === null || t.done) return;
    const tpl = templates.find(x => x.id === t.templateId);
    if (!tpl) return;
    const updated = recalculateDueAt(t, newB, tpl);
    useTasks.getState().update(t.id, {
      dueAt: updated.dueAt,
      title: updated.title,
    });
  });
};

const onBookingRemoved = async (bookingId: string) => {
  const { useTasks } = await import('./tasks');
  useTasks.getState().removeByBooking(bookingId);
};

interface State {
  items: Prenotazione[];
  add: (b: Omit<Prenotazione, 'id'|'creatoIl'|'aggiornatoIl'>) => Prenotazione;
  update: (id: string, patch: Partial<Prenotazione>) => void;
  remove: (id: string) => void;
}

export const useBookings = create<State>((set, get) => ({
  items: [],
  add: (b) => {
    const now = new Date().toISOString();
    const item: Prenotazione = { ...b, id: uid('b'), creatoIl: now, aggiornatoIl: now };
    set({ items: [...get().items, item] });
    const u = getUid();
    if (u) void upsertDoc(u, 'bookings', item.id, item);
    void onBookingCreated(item);
    return item;
  },
  update: (id, patch) => {
    const old = get().items.find(b => b.id === id);
    set({ items: get().items.map(b => b.id === id ? { ...b, ...patch, aggiornatoIl: new Date().toISOString() } : b) });
    const updated = get().items.find(b => b.id === id);
    if (updated) {
      const u = getUid();
      if (u) void upsertDoc(u, 'bookings', updated.id, updated);
      if (old) void onBookingUpdated(old, updated);
    }
  },
  remove: (id) => {
    set({ items: get().items.filter(b => b.id !== id) });
    const u = getUid();
    if (u) void removeDoc(u, 'bookings', id);
    void onBookingRemoved(id);
  },
}));
