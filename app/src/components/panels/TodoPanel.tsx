import { useState } from 'react';
import type { FormEvent } from 'react';
import { useBookings } from '../../store/bookings';
import { usePromemoria } from '../../store/promemoria';
import { useTasks } from '../../store/tasks';
import { overdueTasks } from '../../lib/reminders/overdueTasks';
import { SidePanel } from '../common/SidePanel';
import { BookingCard } from '../common/BookingCard';
import type { Promemoria, BookingTask } from '../../types';

export const TodoPanel = ({ onClose }: { onClose: () => void }) => {
  const bookings = useBookings(s => s.items);
  const { items: promemoria, add, toggle, remove } = usePromemoria();
  const tasks = useTasks(s => s.items);
  const toggleTaskDone = useTasks(s => s.toggleDone);
  const scaduti = overdueTasks(tasks, new Date()).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const [text, setText] = useState('');

  const open = promemoria.filter(p => !p.done).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const done = promemoria.filter(p => p.done).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const auto = bookings.filter(b => b.stato === 'proposta' || b.stato === 'anticipo_atteso')
    .sort((a, b) => a.checkin.localeCompare(b.checkin));

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    add(text.trim()); setText('');
  };

  const PromemoriaCard = ({ p }: { p: Promemoria }) => {
    const dt = new Date(p.createdAt);
    const when = dt.toLocaleDateString('it-IT',{day:'numeric',month:'short'}) + ' ' + dt.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
    return (
      <div className={`promemoria-card${p.done ? ' done' : ''}`}>
        <input type="checkbox" checked={p.done} onChange={() => toggle(p.id)} />
        <div className="txt">{p.testo}<div className="meta">{when}</div></div>
        <button className="del" onClick={() => { if (confirm('Eliminare questa nota?')) remove(p.id); }} title="Elimina">✕</button>
      </div>
    );
  };

  const fmtDateTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const OverdueTaskRow = ({ t }: { t: BookingTask }) => {
    const b = bookings.find(x => x.id === t.bookingId);
    return (
      <div className="promemoria-card">
        <input type="checkbox" checked={t.done} onChange={() => toggleTaskDone(t.id)} aria-label={`Segna ${t.title}`} />
        <div className="txt">
          {t.title}{b ? ` · ${b.nome}` : ''}
          <div className="meta">{fmtDateTime(t.dueAt)}</div>
        </div>
      </div>
    );
  };

  return (
    <SidePanel open title="🔔 Da fare" onClose={onClose}>
      <form className="quicknote" onSubmit={onAdd}>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Aggiungi nota rapida (enter per salvare)…" autoComplete="off" autoFocus />
        <button type="submit" className="btn btn-primary">➕</button>
      </form>
      {scaduti.length > 0 && <>
        <div className="section-title">⏰ Promemoria scaduti ({scaduti.length})</div>
        {scaduti.map(t => <OverdueTaskRow key={t.id} t={t} />)}
      </>}
      {open.length > 0 && <>
        <div className="section-title">📌 Note ({open.length})</div>
        {open.map(p => <PromemoriaCard key={p.id} p={p} />)}
      </>}
      {auto.length > 0 && <>
        <div className="section-title">⏳ Da confermare / anticipi attesi ({auto.length})</div>
        {auto.map(b => <BookingCard key={b.id} b={b} />)}
      </>}
      {done.length > 0 && <>
        <div className="section-title">✓ Fatte ({done.length})</div>
        {done.map(p => <PromemoriaCard key={p.id} p={p} />)}
      </>}
      {open.length + auto.length + done.length + scaduti.length === 0 && (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--ink-soft)' }}>
          Tutto a posto! ✨<br /><span className="text-[11px]">Puoi comunque aggiungere una nota qui sopra.</span>
        </div>
      )}
    </SidePanel>
  );
};
