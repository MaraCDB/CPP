import { useUI } from './store/ui';
import { Home } from './components/Home';
import { CalendarPage } from './components/calendar/CalendarPage';

export default function App() {
  const page = useUI(s => s.page);
  return page === 'home' ? <Home /> : <CalendarPage />;
}
