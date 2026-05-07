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

export const upsertDoc = <T extends { id: string }>(
  uid: string, name: CollectionName, id: string, data: T,
): Promise<void> => setDoc(doc(db, 'users', uid, name, id), data);

export const removeDoc = (
  uid: string, name: CollectionName, id: string,
): Promise<void> => deleteDoc(doc(db, 'users', uid, name, id));

export const goOnline = (): Promise<void> => enableNetwork(db);
export const goOffline = (): Promise<void> => disableNetwork(db);
