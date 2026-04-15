import { useBookings } from '../../store/bookings';
import { useClosures } from '../../store/closures';
import { useUI } from '../../store/ui';
import { useAuth } from '../../store/auth';
import { SidePanel } from '../common/SidePanel';
import { BookingCard } from '../common/BookingCard';
import { parseISO } from '../../lib/date';

const fmt = (d: Date) => d.toLocaleDateString('it-IT',{ day:'numeric', month:'short' });

export const DayDetailPanel = ({ date, onClose }: { date: string; onClose: () => void }) => {
  const bookings = useBookings(s => s.items);
  const closures = useClosures(s => s.items);
  const { openModal } = useUI();
  const readonly = useAuth(s => s.readonly);
  const d = parseISO(date);
  const lampone = bookings.filter(b => b.camera === 'lampone' && parseISO(b.checkin) <= d && parseISO(b.checkout) > d);
  const mirtillo = bookings.filter(b => b.camera === 'mirtillo' && parseISO(b.checkin) <= d && parseISO(b.checkout) > d);
  const ch = closures.find(c => parseISO(c.start) <= d && d <= parseISO(c.end));

  const title = d.toLocaleDateString('it-IT',{ weekday:'long', day:'numeric', month:'long', year:'numeric' });

  return (
    <SidePanel open title={title.charAt(0).toUpperCase()+title.slice(1)} onClose={onClose}>
      {ch && (
        <div className="mb-4 p-3 rounded-xl cursor-pointer hover:opacity-90"
          style={{ background:'repeating-linear-gradient(45deg,var(--chiusura-b),var(--chiusura-b) 6px,var(--surface-2) 6px,var(--surface-2) 12px)', border:'1px solid var(--line-strong)' }}
          onClick={() => openModal({ kind: 'closure', id: ch.id })}>
          <div className="font-semibold mb-1">🔒 Struttura chiusa</div>
          <div className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>{fmt(parseISO(ch.start))} → {fmt(parseISO(ch.end))}</div>
          {ch.note && <div className="text-[12px] italic mt-1" style={{ color: 'var(--ink-soft)' }}>« {ch.note} »</div>}
        </div>
      )}
      {(['lampone','mirtillo'] as const).map(c => {
        const items = c === 'lampone' ? lampone : mirtillo;
        const emoji = c === 'lampone' ? '🍇' : '🫐';
        const name = c === 'lampone' ? 'Lampone' : 'Mirtillo';
        return (
          <div key={c} className="mb-4">
            <div className="text-[11px] uppercase font-semibold mb-2" style={{ color:'var(--ink-soft)', letterSpacing:'.05em' }}>{emoji} {name}</div>
            {items.length
              ? items.map(b => <BookingCard key={b.id} b={b} />)
              : <div className="text-[13px] p-3 rounded-lg" style={{ background:'var(--surface-2)', color:'var(--ink-soft)' }}>{ch ? 'Libera (struttura chiusa)' : 'Libera'}</div>}
          </div>
        );
      })}
      {!readonly && (
        <button className="btn btn-primary w-full mt-2" onClick={() => openModal({ kind: 'booking', prefillCheckin: date })}>
          ➕ Nuova prenotazione per questo giorno
        </button>
      )}
    </SidePanel>
  );
};
