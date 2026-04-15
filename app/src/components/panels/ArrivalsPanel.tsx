import { useBookings } from '../../store/bookings';
import { SidePanel } from '../common/SidePanel';
import { BookingCard } from '../common/BookingCard';
import { parseISO, iso } from '../../lib/date';

export const ArrivalsPanel = ({ onClose }: { onClose: () => void }) => {
  const items = useBookings(s => s.items);
  const TODAY = iso(new Date());
  const arrivi = items
    .filter(b => b.stato !== 'proposta' && parseISO(b.checkin) >= parseISO(TODAY))
    .sort((a, b) => a.checkin.localeCompare(b.checkin))
    .slice(0, 10);
  return (
    <SidePanel open title="📅 Prossimi arrivi" onClose={onClose}>
      {arrivi.length === 0
        ? <div className="text-center py-8 text-sm" style={{ color: 'var(--ink-soft)' }}>Nessun arrivo in programma</div>
        : arrivi.map(b => <BookingCard key={b.id} b={b} />)}
    </SidePanel>
  );
};
