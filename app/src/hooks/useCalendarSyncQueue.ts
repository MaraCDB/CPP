import { useEffect } from 'react';
import { processCalendarQueue } from '../lib/google/calendarSync';
import { useBookings } from '../store/bookings';
import { useClosures } from '../store/closures';
import { useCalendarSettings } from '../store/calendarSettings';
import { useAuth } from '../store/auth';

export const runCalendarSyncQueueNow = (): void => {
  void processCalendarQueue(
    id => useBookings.getState().items.find(b => b.id === id),
    id => useClosures.getState().items.find(c => c.id === id),
  );
};

export const useCalendarSyncQueue = (uid: string | null): void => {
  const calendarId = useCalendarSettings(s => s.googleCalendarId);
  const enabled = useCalendarSettings(s => s.calendarSyncEnabled);
  // Il token arriva async dopo il mount (refresh GIS): senza questa dipendenza
  // la coda non verrebbe drenata al primo giro utile dopo un reload.
  const accessToken = useAuth(s => s.googleAccessToken);

  useEffect(() => {
    if (!uid || !enabled || !calendarId || !accessToken) return;
    runCalendarSyncQueueNow();
    window.addEventListener('online', runCalendarSyncQueueNow);
    return () => window.removeEventListener('online', runCalendarSyncQueueNow);
  }, [uid, enabled, calendarId, accessToken]);
};
