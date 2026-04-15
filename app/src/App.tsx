import { useEffect } from 'react';
import { useAuth } from './store/auth';
import { useUI } from './store/ui';
import { Home } from './components/Home';
import { CalendarPage } from './components/calendar/CalendarPage';
import { SignIn } from './components/SignIn';
import { InstallPrompt } from './components/InstallPrompt';
import { initAuth, startTokenAutoRefresh } from './lib/google/auth';
import { bootSync } from './lib/sync';

export default function App() {
  const user = useAuth(s => s.user);
  const page = useUI(s => s.page);

  useEffect(() => {
    void initAuth().then(startTokenAutoRefresh);
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
