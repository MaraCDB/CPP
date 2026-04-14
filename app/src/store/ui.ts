import { create } from 'zustand';

type Side = null | { kind: 'todo' } | { kind: 'arrivi' } | { kind: 'day'; date: string };
type Modal = null | { kind: 'booking'; id?: string; prefillCheckin?: string } | { kind: 'closure'; id?: string };

interface State {
  side: Side;
  modal: Modal;
  page: 'home' | 'calendar';
  openSide: (s: Side) => void;
  closeSide: () => void;
  openModal: (m: Modal) => void;
  closeModal: () => void;
  goHome: () => void;
  goCalendar: () => void;
}

export const useUI = create<State>((set) => ({
  side: null,
  modal: null,
  page: 'home',
  openSide: (side) => set({ side, modal: null }),
  closeSide: () => set({ side: null }),
  openModal: (modal) => set({ modal, side: null }),
  closeModal: () => set({ modal: null }),
  goHome: () => set({ page: 'home', side: null, modal: null }),
  goCalendar: () => set({ page: 'calendar' }),
}));
