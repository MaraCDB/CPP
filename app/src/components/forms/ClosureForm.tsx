import { useState } from 'react';
import type { FormEvent } from 'react';
import { useClosures } from '../../store/closures';
import { useAuth } from '../../store/auth';
import { Modal } from '../common/Modal';

interface Props { id?: string; onClose: () => void; }

export const ClosureForm = ({ id, onClose }: Props) => {
  const readonly = useAuth(s => s.readonly);
  const { items, add, update, remove } = useClosures();
  const existing = id ? items.find(c => c.id === id) : undefined;
  const [start, setStart] = useState(existing?.start || '');
  const [end, setEnd] = useState(existing?.end || '');
  const [note, setNote] = useState(existing?.note || '');

  if (readonly) return null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (end < start) { alert('La data di fine deve essere uguale o successiva a quella di inizio'); return; }
    const payload = { start, end, note: note.trim() || undefined };
    if (existing) update(existing.id, payload);
    else add(payload);
    onClose();
  };

  const onDelete = () => {
    if (!existing) return;
    if (!confirm('Eliminare questo periodo di chiusura?')) return;
    remove(existing.id);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={existing ? '🔒 Modifica chiusura' : '🔒 Nuovo periodo di chiusura'}>
      <form onSubmit={onSubmit} className="p-4">
        <div className="text-[13px] mb-3 p-3 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>
          La struttura resta chiusa in queste date. Puoi comunque salvare prenotazioni (es. famiglia/amici) ricevendo un avviso.
        </div>
        <div className="row2">
          <label className="field"><span>Da</span><input type="date" required value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="field"><span>A (incluso)</span><input type="date" required value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        </div>
        <label className="field"><span>Nota (motivo)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="es. Vacanza famiglia, Lavori..." /></label>
        <div className="flex justify-between items-center mt-4">
          {existing ? <button type="button" className="btn btn-danger" onClick={onDelete}>Elimina</button> : <span />}
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary">Salva</button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
