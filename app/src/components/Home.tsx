import { useBookings } from '../store/bookings';
import { usePromemoria } from '../store/promemoria';
import { useUI } from '../store/ui';
import { ThemeToggle } from './ThemeToggle';
import { SyncIndicator } from './SyncIndicator';
import { parseISO, nightsBetween, iso } from '../lib/date';

export const Home = () => {
  const bookings = useBookings(s => s.items);
  const promemoria = usePromemoria(s => s.items);
  const { goCalendar, openSide } = useUI();

  const todoCount = bookings.filter(b => b.stato === 'proposta' || b.stato === 'anticipo_atteso').length
    + promemoria.filter(p => !p.done).length;
  const today = iso(new Date());
  const arriviCount = bookings.filter(b =>
    b.stato !== 'proposta' &&
    parseISO(b.checkin) >= parseISO(today) &&
    nightsBetween(today, b.checkin) <= 30
  ).length;

  const goDafare = () => { goCalendar(); openSide({ kind: 'todo' }); };
  const goArrivi = () => { goCalendar(); openSide({ kind: 'arrivi' }); };

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
      <div className="home-buttons">
        <button className="home-btn" onClick={goDafare}>
          <span className={'badge warn' + (todoCount === 0 ? ' zero' : '')}>{todoCount}</span>
          <span className="icn">🔔</span>
          <span className="ttl">Da fare</span>
          <span className="sub">Promemoria, proposte in attesa, anticipi da ricevere</span>
        </button>
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
      </div>
    </section>
  );
};
