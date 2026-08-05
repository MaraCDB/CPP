import { useEffect } from 'react';
import { processCalendarQueue } from '../lib/google/calendarSync';
import { useBookings } from '../store/bookings';
import { useClosures } from '../store/closures';

const runQueue = (): void => {
  void processCalendarQueue(
    id => useBookings.getState().items.find(b => b.id === id),
    id => useClosures.getState().items.find(c => c.id === id),
  );
};

export const useCalendarSyncQueue = (uid: string | null): void => {
  useEffect(() => {
    if (!uid) return;
    runQueue();
    window.addEventListener('online', runQueue);
    return () => window.removeEventListener('online', runQueue);
  }, [uid]);
};
