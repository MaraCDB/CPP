import { useState, useEffect } from 'react';
import { useBookings } from '../store/bookings';
import { useUI } from '../store/ui';
import { ThemeToggle } from './ThemeToggle';
import { SyncIndicator } from './SyncIndicator';
import { parseISO, nightsBetween, iso } from '../lib/date';
import { TemplatesPage } from './settings/TemplatesPage';
import { useTasks } from '../store/tasks';
import { overdueTasks } from '../lib/reminders/overdueTasks';

export const Home = () => {
  const bookings = useBookings(s => s.items);
  const { goCalendar, openSide } = useUI();
  const [showTemplates, setShowTemplates] = useState(false);
  const tasks = useTasks(s => s.items);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  if (showTemplates) return <TemplatesPage onBack={() => setShowTemplates(false)} />;

  const today = iso(new Date());
  const arriviCount = bookings.filter(b =>
    b.stato !== 'proposta' &&
    parseISO(b.checkin) >= parseISO(today) &&
    nightsBetween(today, b.checkin) <= 30
  ).length;

  const goArrivi = () => { goCalendar(); openSide({ kind: 'arrivi' }); };
  const overdueCount = overdueTasks(tasks, now).length;
  const goOverdue = () => { goCalendar(); openSide({ kind: 'todo' }); };

  return (
    <section className="home">
      <ThemeToggle floating />
      <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 14px)', right: '66px' }}>
        <SyncIndicator />
      </div>
      <div className="home-hero">
        <div className="logo" style={{ background: 'linear-gradient(135deg,var(--lampone),var(--mirtillo))' }}>🏡</div>
        <h1>Cuore di Bosco</h1>
        <p>Cosa vuoi fare?</p>
      </div>
      {overdueCount > 0 && (
        <button
          className="text-left text-[13px] font-medium rounded-xl px-4 py-3 mb-4"
          style={{ background: 'var(--banner-bg)', color: 'var(--banner-text)', border: 'none', cursor: 'pointer', width: 'min(420px,100%)' }}
          onClick={goOverdue}
        >
          ⚠️ {overdueCount} promemoria scadut{overdueCount === 1 ? 'o' : 'i'} da controllare
        </button>
      )}
      <div className="home-buttons">
        <button className="home-btn" onClick={goCalendar}>
          <span className="icn">📅</span>
          <span className="ttl">Calendario</span>
          <span className="sub">Vista mese · trimestre · semestre · anno</span>
        </button>
        <button className="home-btn" onClick={goArrivi}>
          <span className={'badge neutral' + (arriviCount === 0 ? ' zero' : '')}>{arriviCount}</span>
          <span className="icn">🧳</span>
          <span className="ttl">Arrivi</span>
          <span className="sub">Chi sta per arrivare nei prossimi 30 giorni</span>
        </button>
        <button className="home-btn" onClick={() => setShowTemplates(true)}>
          <span className="icn">⚙️</span>
          <span className="ttl">Impostazioni</span>
          <span className="sub">Template promemoria e notifiche</span>
        </button>
      </div>
    </section>
  );
};
