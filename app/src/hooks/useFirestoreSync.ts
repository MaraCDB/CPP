import { useEffect } from 'react';
import { subscribeCollection, subscribeUserSettings } from '../lib/firebase/db';
import { useBookings } from '../store/bookings';
import { useClosures } from '../store/closures';
import { usePromemoria } from '../store/promemoria';
import { useTasks } from '../store/tasks';
import { useTemplates } from '../store/templates';
import { useCalendarSettings } from '../store/calendarSettings';
import { idbSet } from '../lib/idb';
import type { Prenotazione, Chiusura, Promemoria, BookingTask, ReminderTemplate } from '../types';

export const useFirestoreSync = (uid: string | null): void => {
  useEffect(() => {
    if (!uid) return;
    const unsubs = [
      subscribeCollection<Prenotazione>(uid, 'bookings', items => {
        useBookings.setState({ items });
      }),
      subscribeCollection<Chiusura>(uid, 'closures', items => {
        useClosures.setState({ items });
      }),
      subscribeCollection<Promemoria>(uid, 'promemoria', items => {
        usePromemoria.setState({ items });
      }),
      subscribeCollection<BookingTask>(uid, 'tasks', items => {
        useTasks.setState({ items });
        void idbSet('tasks', 'all', items);
      }),
      subscribeCollection<ReminderTemplate>(uid, 'templates', items => {
        if (items.length > 0) useTemplates.setState({ items });
      }),
      subscribeUserSettings(uid, settings => {
        useCalendarSettings.setState({
          googleCalendarId: settings.googleCalendarId ?? null,
          googleCalendarName: settings.googleCalendarName ?? null,
          calendarSyncEnabled: settings.calendarSyncEnabled ?? false,
        });
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [uid]);
};
