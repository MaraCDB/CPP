import type { BookingTask } from '../../types';

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

interface Props {
  tasks: BookingTask[];
  mode: 'automatic' | 'services' | 'all';
  onToggleDone: (id: string) => void;
  onEdit: (id: string) => void;
}

export const TaskList = ({ tasks, mode, onToggleDone, onEdit }: Props) => {
  const filtered = tasks.filter(t => {
    if (t.deletedAt) return false;
    if (mode === 'automatic') return !t.isService;
    if (mode === 'services') return t.isService;
    return true;
  });

  if (filtered.length === 0) {
    return <div className="text-[13px]" style={{ color: 'var(--ink-soft)' }}>Nessun promemoria.</div>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {filtered.map(t => (
        <li
          key={t.id}
          className="rounded-xl p-3 border flex items-start gap-3"
          style={{ borderColor: 'var(--line)', opacity: t.notify ? 1 : 0.5 }}
        >
          <input
            type="checkbox"
            checked={t.done}
            onChange={() => onToggleDone(t.id)}
            aria-label={`Segna ${t.title}`}
          />
          <div className="flex-1">
            <div className={`font-medium text-sm ${t.done ? 'line-through' : ''}`}>{t.title}</div>
            <div className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>📅 {fmtDateTime(t.dueAt)}</div>
            {t.notes && <div className="text-[12px] italic mt-1" style={{ color: 'var(--ink-soft)' }}>« {t.notes} »</div>}
          </div>
          <button type="button" className="btn btn-ghost text-[12px]" onClick={() => onEdit(t.id)}>✏️</button>
        </li>
      ))}
    </ul>
  );
};
