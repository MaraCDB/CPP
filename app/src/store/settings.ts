import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tema, Vista } from '../types';

interface State {
  tema: Tema;
  setTema: (t: Tema) => void;
  vista: Vista;
  setVista: (v: Vista) => void;
  anchor: string;
  setAnchor: (a: string) => void;
  shiftAnchor: (months: number) => void;
}

export const useSettings = create<State>()(persist((set, get) => ({
  tema: 'auto',
  setTema: (tema) => set({ tema }),
  vista: 'mese',
  setVista: (vista) => set({ vista }),
  anchor: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  setAnchor: (anchor) => set({ anchor }),
  shiftAnchor: (months) => {
    const [y, m] = get().anchor.split('-').map(Number);
    const d = new Date(y, m - 1 + months, 1);
    set({ anchor: d.toISOString().slice(0, 10) });
  },
}), { name: 'cdb_settings_v1' }));
