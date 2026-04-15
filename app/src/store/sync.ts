import { create } from 'zustand';
import type { SyncStatus, PendingOp } from '../types';

interface State {
  status: SyncStatus;
  queue: PendingOp[];
  spreadsheetId: string | null;
  setStatus: (s: SyncStatus) => void;
  setSpreadsheetId: (id: string) => void;
  enqueue: (op: PendingOp) => void;
  removeOp: (id: string) => void;
  setQueue: (q: PendingOp[]) => void;
}

export const useSync = create<State>((set, get) => ({
  status: 'unauth',
  queue: [],
  spreadsheetId: null,
  setStatus: (status) => set({ status }),
  setSpreadsheetId: (spreadsheetId) => set({ spreadsheetId }),
  enqueue: (op) => set({ queue: [...get().queue, op] }),
  removeOp: (id) => set({ queue: get().queue.filter(o => o.id !== id) }),
  setQueue: (queue) => set({ queue }),
}));
