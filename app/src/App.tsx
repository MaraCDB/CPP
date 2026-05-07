import { useEffect } from 'react';
import { useAuth } from './store/auth';
import { useUI } from './store/ui';
import { Home } from './components/Home';
import { CalendarPage } from './components/calendar/CalendarPage';
import { SignIn } from './components/SignIn';
import { InstallPrompt } from './components/InstallPrompt';
import { NotificationOnboarding } from './components/NotificationOnboarding';
import { auth, initAuthListener } from './lib/firebase/auth';
import { initPersistence } from './lib/firebase/db';
import { useFirestoreSync } from './hooks/useFirestoreSync';
import { useTemplates } from './store/templates';
import { useTasks } from './store/tasks';
import { idbGet } from './lib/idb';
import type { BookingTask } from './types';
import { scheduleTask, cancelAll } from './lib/notifications/foregroundScheduler';

export default function App() {
  const user = useAuth(s => s.user);
  const page = useUI(s => s.page);

  useEffect(() => {
    void initPersistence();
    const unsub = initAuthListener();
    useTemplates.getState().seedDefaults();
    void idbGet<BookingTask[]>('tasks', 'all').then(arr => {
      if (arr) useTasks.setState({ items: arr });
    });

    let removeMsgListener: (() => void) | undefined;
    if ('serviceWorker' in navigator) {
      const onMessage = (e: MessageEvent) => {
        if ((e.data as { type?: string } | undefined)?.type === 'open-task') {
          const { bookingId } = e.data as { bookingId?: string };
          if (bookingId) useUI.getState().openModal({ kind: 'booking', id: bookingId });
          void idbGet<BookingTask[]>('tasks', 'all').then(arr => {
            if (arr) useTasks.setState({ items: arr });
          });
        }
      };
      navigator.serviceWorker.addEventListener('message', onMessage);
      removeMsgListener = () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }

    return () => {
      unsub();
      removeMsgListener?.();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get('booking');
    if (bookingId) {
      useUI.getState().openModal({ kind: 'booking', id: bookingId });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const uid = user ? auth.currentUser?.uid ?? null : null;
  useFirestoreSync(uid);

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
