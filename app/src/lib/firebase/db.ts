import {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager,
  collection, doc, onSnapshot, setDoc, deleteDoc,
  enableNetwork, disableNetwork,
} from 'firebase/firestore';
import { app } from './config';

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
});

export const initPersistence = async (): Promise<boolean> => true;

export type CollectionName =
  | 'bookings' | 'closures' | 'promemoria' | 'tasks' | 'templates';

export const subscribeCollection = <T>(
  uid: string,
  name: CollectionName,
  cb: (items: T[]) => void,
): (() => void) => {
  const ref = collection(db, 'users', uid, name);
  return onSnapshot(ref, snap => {
    cb(snap.docs.map(d => d.data() as T));
  });
};

// Firestore rejects `undefined` in document fields. Strip them before write
// (optional fields like `riferimento?: string` come through as undefined when
// the user doesn't fill them).
const stripUndefined = <T extends Record<string, unknown>>(o: T): T => {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = stripUndefined(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
};

export const upsertDoc = <T extends { id: string }>(
  uid: string, name: CollectionName, id: string, data: T,
): Promise<void> => setDoc(doc(db, 'users', uid, name, id), stripUndefined(data as unknown as Record<string, unknown>));

export const removeDoc = (
  uid: string, name: CollectionName, id: string,
): Promise<void> => deleteDoc(doc(db, 'users', uid, name, id));

export const goOnline = (): Promise<void> => enableNetwork(db);
export const goOffline = (): Promise<void> => disableNetwork(db);
