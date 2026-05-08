import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { iso } from '../lib/date';
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
  anchor: iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  setAnchor: (anchor) => set({ anchor }),
  shiftAnchor: (months) => {
    const [y, m] = get().anchor.split('-').map(Number);
    set({ anchor: iso(new Date(y, m - 1 + months, 1)) });
  },
}), { name: 'cdb_settings_v1' }));
