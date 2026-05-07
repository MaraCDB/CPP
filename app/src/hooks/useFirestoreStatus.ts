import { useEffect, useState } from 'react';
import { useAuth } from '../store/auth';

export type FirestoreStatus = 'idle' | 'offline' | 'unauth';

export const useFirestoreStatus = (): FirestoreStatus => {
  const user = useAuth(s => s.user);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!user) return 'unauth';
  if (!online) return 'offline';
  return 'idle';
};
