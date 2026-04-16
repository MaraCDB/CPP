import { useBookings } from '../../store/bookings';
import { usePromemoria } from '../../store/promemoria';
import { useSettings } from '../../store/settings';
import { useUI } from '../../store/ui';
import { useAuth } from '../../store/auth';
import { parseISO, nightsBetween, iso } from '../../lib/date';

export const BottomBar = () => {
  const bookings = useBookings(s => s.items);
  const promemoria = usePromemoria(s => s.items);
  const { openSide, openModal } = useUI();
  const setAnchor = useSettings(s => s.setAnchor);
  const readonly = useAuth(s => s.readonly);

  const today = iso(new Date());
  const todoCount = bookings.filter(b => b.stato === 'proposta' || b.stato === 'anticipo_atteso').length
    + promemoria.filter(p => !p.done).length;
  const arriviCount = bookings.filter(b =>
    b.stato !== 'proposta' &&
    parseISO(b.checkin) >= parseISO(today) &&
    nightsBetween(today, b.checkin) <= 30
  ).length;

  return (
    <footer className="bottombar sticky bottom-0">
      <button className="counter warn" onClick={() => openSide({ kind: 'todo' })}>
        🔔<span className="lbl"> Da fare</span> <span className="badge">{todoCount}</span>
      </button>
      <button className="counter" onClick={() => openSide({ kind: 'arrivi' })}>
        🧳<span className="lbl"> Arrivi</span> <span className="badge">{arriviCount}</span>
      </button>
      {!readonly && (
        <button className="btn btn-ghost" title="Chiusura" onClick={() => openModal({ kind: 'closure' })}>🔒</button>
      )}
      <button className="btn btn-ghost" onClick={() => setAnchor(iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))}>
        📅 <span className="lbl">Oggi</span>
      </button>
      {!readonly && (
        <button className="btn btn-primary" onClick={() => openModal({ kind: 'booking', prefillCheckin: today })}>
          ➕ <span className="lbl">Nuova</span>
        </button>
      )}
    </footer>
  );
};
