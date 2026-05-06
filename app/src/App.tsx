import { useEffect } from 'react';
import { useAuth } from './store/auth';
import { useUI } from './store/ui';
import { Home } from './components/Home';
import { CalendarPage } from './components/calendar/CalendarPage';
import { SignIn } from './components/SignIn';
import { InstallPrompt } from './components/InstallPrompt';
import { NotificationOnboarding } from './components/NotificationOnboarding';
import { initAuth, silentRefresh, startTokenAutoRefresh } from './lib/google/auth';
import { bootSync } from './lib/sync';
import { useTemplates } from './store/templates';
import { useTasks } from './store/tasks';
import { idbGet } from './lib/idb';
import type { BookingTask } from './types';
import { scheduleTask, cancelAll } from './lib/notifications/foregroundScheduler';

export default function App() {
  const user = useAuth(s => s.user);
  const accessToken = useAuth(s => s.accessToken);
  const page = useUI(s => s.page);

  useEffect(() => {
    void initAuth().then(() => {
      startTokenAutoRefresh();
      if (useAuth.getState().user) silentRefresh();
    });
    useTemplates.getState().seedDefaults();
    void idbGet<BookingTask[]>('tasks', 'all').then(arr => {
      if (arr) useTasks.setState({ items: arr });
    });

    if ('serviceWorker' in navigator) {
      const onMessage = (e: MessageEvent) => {
        if ((e.data as { type?: string } | undefined)?.type === 'open-task') {
          const { bookingId } = e.data as { bookingId?: string };
          if (bookingId) useUI.getState().openModal({ kind: 'booking', id: bookingId });
          // Re-hydrate i task perché il SW potrebbe averli aggiornati
          void idbGet<BookingTask[]>('tasks', 'all').then(arr => {
            if (arr) useTasks.setState({ items: arr });
          });
        }
      };
      navigator.serviceWorker.addEventListener('message', onMessage);
      return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }
  }, []);

  // Lookup query string al boot per deep-link da notifica
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get('booking');
    if (bookingId) {
      useUI.getState().openModal({ kind: 'booking', id: bookingId });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (user && accessToken) void bootSync();
  }, [user, accessToken]);

  // foreground scheduler: re-schedule on tasks store updates
  useEffect(() => {
    const onShown = (taskId: string) =>
      useTasks.getState().update(taskId, {
        notificationStatus: 'shown',
        notificationShownAt: new Date().toISOString(),
      });

    const reschedule = () => {
      cancelAll();
      const all = useTasks.getState().items;
      all.forEach(t => scheduleTask(t, onShown));
    };

    reschedule();
    const unsub = useTasks.subscribe(reschedule);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') cancelAll();
      else reschedule();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      unsub();
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAll();
    };
  }, []);

  if (!user) return <SignIn />;
  return (
    <>
      <InstallPrompt />
      <NotificationOnboarding />
      {page === 'home' ? <Home /> : <CalendarPage />}
    </>
  );
}
