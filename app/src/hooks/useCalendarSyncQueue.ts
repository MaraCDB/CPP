import { useEffect } from 'react';
import { processCalendarQueue } from '../lib/google/calendarSync';
import { useBookings } from '../store/bookings';
import { useClosures } from '../store/closures';
import { useCalendarSettings } from '../store/calendarSettings';

export const runCalendarSyncQueueNow = (): void => {
  void processCalendarQueue(
    id => useBookings.getState().items.find(b => b.id === id),
    id => useClosures.getState().items.find(c => c.id === id),
  );
};

export const useCalendarSyncQueue = (uid: string | null): void => {
  const calendarId = useCalendarSettings(s => s.googleCalendarId);
  const enabled = useCalendarSettings(s => s.calendarSyncEnabled);

  useEffect(() => {
    if (!uid || !enabled || !calendarId) return;
    runCalendarSyncQueueNow();
    window.addEventListener('online', runCalendarSyncQueueNow);
    return () => window.removeEventListener('online', runCalendarSyncQueueNow);
  }, [uid, enabled, calendarId]);
};
