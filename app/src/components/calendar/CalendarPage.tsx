import { useSettings } from '../../store/settings';
import { useUI } from '../../store/ui';
import { Topbar } from './Topbar';
import { BottomBar } from './BottomBar';
import { MonthGoogleView } from './MonthGoogleView';
import { VerticalGanttView } from './VerticalGanttView';
import { DayDetailPanel } from '../panels/DayDetailPanel';
import { TodoPanel } from '../panels/TodoPanel';
import { ArrivalsPanel } from '../panels/ArrivalsPanel';
import { BookingForm } from '../forms/BookingForm';
import { ClosureForm } from '../forms/ClosureForm';

export const CalendarPage = () => {
  const vista = useSettings(s => s.vista);
  const { side, modal, closeSide, closeModal } = useUI();

  return (
    <>
      <Topbar />
      <div className="px-4 py-2 text-[12px]" style={{ background: 'var(--banner-bg)', color: 'var(--banner-text)', borderBottom: '1px solid var(--banner-border)' }}>
        🎨 <b>App locale</b> · dati in localStorage · Google Sheets in arrivo (Piano B)
      </div>
      <main className="p-3 md:p-5">
        {vista === 'mese' ? <MonthGoogleView /> : <VerticalGanttView />}
      </main>
      <BottomBar />

      {side?.kind === 'todo' && <TodoPanel onClose={closeSide} />}
      {side?.kind === 'arrivi' && <ArrivalsPanel onClose={closeSide} />}
      {side?.kind === 'day' && <DayDetailPanel date={side.date} onClose={closeSide} />}

      {modal?.kind === 'booking' && <BookingForm id={modal.id} prefillCheckin={modal.prefillCheckin} onClose={closeModal} />}
      {modal?.kind === 'closure' && <ClosureForm id={modal.id} onClose={closeModal} />}
    </>
  );
};
