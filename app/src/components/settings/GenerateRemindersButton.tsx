import { useState } from 'react';
import { useBookings } from '../../store/bookings';
import { useTemplates } from '../../store/templates';
import { useTasks } from '../../store/tasks';
import { materializeTasks } from '../../lib/reminders/materialize';

export const GenerateRemindersButton = () => {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const run = () => {
    setRunning(true);
    const bookings = useBookings.getState().items;
    const templates = useTemplates.getState().items;
    let count = 0;
    bookings.forEach(b => {
      const existing = useTasks.getState().byBooking(b.id);
      if (existing.length > 0) return; // skip se ha già task
      const tasks = materializeTasks(b, templates);
      useTasks.getState().addMany(tasks);
      count += tasks.length;
    });
    setDone(count);
    setRunning(false);
  };

  return (
    <div className="p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
      <div className="text-sm mb-2">Materializza promemoria per i booking che ne sono privi.</div>
      <button className="btn btn-primary" disabled={running} onClick={run}>
        {running ? 'In corso...' : 'Genera promemoria per booking esistenti'}
      </button>
      {done !== null && (
        <div className="text-[12px] mt-2" style={{ color: 'var(--ink-soft)' }}>
          ✓ Generati {done} task.
        </div>
      )}
    </div>
  );
};
