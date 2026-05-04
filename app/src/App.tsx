import { useEffect } from 'react';
import { useAuth } from './store/auth';
import { useUI } from './store/ui';
import { Home } from './components/Home';
import { CalendarPage } from './components/calendar/CalendarPage';
import { SignIn } from './components/SignIn';
import { InstallPrompt } from './components/InstallPrompt';
import { initAuth, startTokenAutoRefresh } from './lib/google/auth';
import { bootSync } from './lib/sync';
import { useTemplates } from './store/templates';
import { useTasks } from './store/tasks';
import { idbGet } from './lib/idb';
import type { BookingTask } from './types';

export default function App() {
  const user = useAuth(s => s.user);
  const page = useUI(s => s.page);

  useEffect(() => {
    void initAuth().then(startTokenAutoRefresh);
    useTemplates.getState().seedDefaults();
    void idbGet<BookingTask[]>('tasks', 'all').then(arr => {
      if (arr) useTasks.setState({ items: arr });
    });
  }, []);

  useEffect(() => {
    if (user) void bootSync();
  }, [user]);

  if (!user) return <SignIn />;
  return (
    <>
      <InstallPrompt />
      {page === 'home' ? <Home /> : <CalendarPage />}
    </>
  );
}
