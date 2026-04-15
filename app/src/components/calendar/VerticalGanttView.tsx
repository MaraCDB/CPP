import { useBookings } from '../../store/bookings';
import { useClosures } from '../../store/closures';
import { useSettings } from '../../store/settings';
import { useUI } from '../../store/ui';
import { parseISO, iso, MONTHS, MONTHS_SHORT, WD } from '../../lib/date';
import type { Camera, Prenotazione, Chiusura, Vista } from '../../types';

const MONTHS_COUNT: Record<Vista, number> = { mese: 1, trim: 3, sem: 6, anno: 12 };

const findBooking = (date: string, camera: Camera, items: Prenotazione[]): Prenotazione | null => {
  const d = parseISO(date);
  const matches = items.filter(b => b.camera === camera && parseISO(b.checkin) <= d && parseISO(b.checkout) > d);
  if (!matches.length) return null;
  const priority = { confermato: 0, anticipo_atteso: 1, proposta: 2 } as const;
  matches.sort((a, b) => priority[a.stato] - priority[b.stato]);
  return matches[0];
};
const findClosure = (date: string, items: Chiusura[]) => {
  const d = parseISO(date);
  return items.find(c => parseISO(c.start) <= d && d <= parseISO(c.end));
};

const MonthCol = ({ year, month }: { year: number; month: number }) => {
  const bookings = useBookings(s => s.items);
  const closures = useClosures(s => s.items);
  const vista = useSettings(s => s.vista);
  const { openSide, openModal } = useUI();
  const TODAY = iso(new Date());
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const headLabel = (vista === 'anno' || vista === 'sem') ? MONTHS_SHORT[month] : `${MONTHS[month]} ${year}`;

  const rows = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    const dStr = iso(dt);
    const dow = dt.getDay();
    const ch = findClosure(dStr, closures);
    const isToday = dStr === TODAY;
    const cls = [
      'day-row',
      (dow === 0 || dow === 6) ? 'we' : '',
      isToday ? 'today' : '',
      ch ? 'chiusura' : '',
      ch?.start === dStr ? 'closure-first' : '',
      ch?.end === dStr ? 'closure-last' : '',
    ].filter(Boolean).join(' ');

    const renderRoom = (camera: Camera) => {
      const b = findBooking(dStr, camera, bookings);
      const baseCls = `room-cell ${b ? `booked ${camera} ${b.stato}` : ''}`;
      if (!b) return <div key={camera} className={baseCls} onClick={() => openSide({ kind: 'day', date: dStr })} />;
      const isFirst = b.checkin === dStr;
      const checkoutPrev = iso(new Date(parseISO(b.checkout).getTime() - 86400000));
      const isLast = checkoutPrev === dStr;
      const showLabel = isFirst && vista !== 'sem' && vista !== 'anno';
      return (
        <div key={camera}
          className={`${baseCls}${isFirst ? ' first-of-booking' : ''}${isLast ? ' last-of-booking' : ''}`}
          title={`${b.nome}${b.riferimento ? ' (' + b.riferimento + ')' : ''}`}
          onClick={(e) => { e.stopPropagation(); openModal({ kind: 'booking', id: b.id }); }}>
          {showLabel && (
            <div className="label">
              <span>{b.nome}</span>
              {b.riferimento && <span className="ref">{b.riferimento}</span>}
            </div>
          )}
        </div>
      );
    };

    rows.push(
      <div key={d} className={cls}>
        <div className="day-num">
          <div className="dn">{d}</div>
          <div className="dw">{WD[dow]}</div>
        </div>
        {renderRoom('lampone')}
        {renderRoom('mirtillo')}
      </div>
    );
  }

  return (
    <div className="month-col">
      <div className="month-head">{headLabel}</div>
      <div className="month-sub-head"><div></div><div>🍇 L</div><div>🫐 M</div></div>
      <div className="month-grid">{rows}</div>
    </div>
  );
};

export const VerticalGanttView = () => {
  const vista = useSettings(s => s.vista);
  const anchor = useSettings(s => s.anchor);
  const a = parseISO(anchor);
  const yStart = a.getFullYear();
  const mStart = vista === 'anno' ? 0 : a.getMonth();
  const count = MONTHS_COUNT[vista];

  const cols = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(yStart, mStart + i, 1);
    cols.push(<MonthCol key={i} year={d.getFullYear()} month={d.getMonth()} />);
  }
  return <div className={`months-wrap wrap-${vista}`}>{cols}</div>;
};
