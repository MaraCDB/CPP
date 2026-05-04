import { openDB, type IDBPDatabase } from 'idb';

const DB = 'cdb_cache';
const VERSION = 2;

let dbP: Promise<IDBPDatabase> | null = null;
const db = () => dbP ??= openDB(DB, VERSION, {
  upgrade(d, oldVersion) {
    if (oldVersion < 1) {
      ['bookings','closures','promemoria','settings'].forEach(s => {
        if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
      });
    }
    if (oldVersion < 2) {
      ['tasks','templates'].forEach(s => {
        if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
      });
    }
  },
});

export const idbGet = async <T = unknown>(store: string, key: string): Promise<T | undefined> => (await db()).get(store, key) as Promise<T | undefined>;
export const idbSet = async (store: string, key: string, val: unknown): Promise<void> => { await (await db()).put(store, val, key); };
export const idbDel = async (store: string, key: string): Promise<void> => { await (await db()).delete(store, key); };
