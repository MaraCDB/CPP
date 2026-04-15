import { useRef } from 'react';
import type { ReactNode, TouchEvent } from 'react';
import { useBookings } from '../../store/bookings';
import { useClosures } from '../../store/closures';
import { useSettings } from '../../store/settings';
import { useUI } from '../../store/ui';
import { parseISO, iso } from '../../lib/date';
import type { Camera, Prenotazione, Chiusura } from '../../types';

const findBooking = (date: string, camera: Camera, items: Prenotazione[]): Prenotazione | null => {
  const d = parseISO(date);
  const matches = items.filter(b => b.camera === camera && parseISO(b.checkin) <= d && parseISO(b.checkout) > d);
  if (!matches.length) return null;
  const priority = { confermato: 0, anticipo_atteso: 1, proposta: 2 } as const;
  matches.sort((a, b) => priority[a.stato] - priority[b.stato]);
  return matches[0];
};

const findClosure = (date: string, items: Chiusura[]): Chiusura | undefined => {
  const d = parseISO(date);
  return items.find(c => parseISO(c.start) <= d && d <= parseISO(c.end));
};

export const MonthGoogleView = () => {
  const bookings = useBookings(s => s.items);
  const closures = useClosures(s => s.items);
  const anchor = useSettings(s => s.anchor);
  const shiftAnchor = useSettings(s => s.shiftAnchor);
  const { openSide, openModal } = useUI();
  const TODAY = iso(new Date());

  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (!touchRef.current) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    touchRef.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    shiftAnchor(dx < 0 ? 1 : -1);
  };

  const a = parseISO(anchor);
  const y = a.getFullYear(), m = a.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const first = new Date(y, m, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const cells: ReactNode[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - startOffset;
    if (dayOffset < 0 || dayOffset >= daysInMonth) {
      cells.push(<div key={i} className="mg-cell out" />);
      continue;
    }
    const dt = new Date(y, m, dayOffset + 1);
    const dStr = iso(dt);
    const dow = dt.getDay();
    const isWE = dow === 0 || dow === 6;
    const isToday = dStr === TODAY;
    const ch = findClosure(dStr, closures);
    const closureFirst = ch?.start === dStr;
    const closureLast = ch?.end === dStr;

    const cellClasses = [
      'mg-cell',
      isWE ? 'we' : '',
      isToday ? 'today' : '',
      ch ? 'chiusura' : '',
      closureFirst ? 'closure-first' : '',
      closureLast ? 'closure-last' : '',
    ].filter(Boolean).join(' ');

    const renderRoom = (camera: Camera) => {
      const b = findBooking(dStr, camera, bookings);
      if (!b) return <div key={camera} className="mg-slot empty" />;
      const isFirst = b.checkin === dStr;
      const weekStart = dow === 1;
      return (
        <div key={camera}
          className={`mg-slot ${camera} ${b.stato}${ch ? ' closed-lock' : ''}`}
          title={`${b.nome}${b.riferimento ? ' (' + b.riferimento + ')' : ''}`}
          onClick={(e) => { e.stopPropagation(); openModal({ kind: 'booking', id: b.id }); }}>
          {(isFirst || weekStart) && <>
            <span>{b.nome}</span>
            {b.riferimento && <span className="ref">{b.riferimento}</span>}
          </>}
        </div>
      );
    };

    cells.push(
      <div key={i} className={cellClasses}
        title={ch ? `🔒 ${ch.note || 'Struttura chiusa'}` : ''}
        onClick={() => openSide({ kind: 'day', date: dStr })}>
        <div className="mg-day">{dayOffset + 1}</div>
        <div className="mg-rooms">
          {renderRoom('lampone')}
          {renderRoom('mirtillo')}
        </div>
      </div>
    );
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="mg">
        <div className="mg-head">
          {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="mg-grid">{cells}</div>
      </div>
    </div>
  );
};
