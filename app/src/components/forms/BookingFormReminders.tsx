import { useState } from 'react';
import { useTasks } from '../../store/tasks';
import { useTemplates } from '../../store/templates';
import { TaskList } from '../common/TaskList';
import { uid } from '../../lib/id';
import type { BookingTask } from '../../types';

interface Props {
  bookingId: string;
  bookingCheckin?: string; // YYYY-MM-DD, used to prefill custom dueAt
}

export const BookingFormReminders = ({ bookingId, bookingCheckin }: Props) => {
  const tasksForBooking = useTasks(s => s.byBooking(bookingId));
  const updateTask = useTasks(s => s.update);
  const toggleDoneTask = useTasks(s => s.toggleDone);
  const addTask = useTasks(s => s.add);
  const templates = useTemplates(s => s.items);

  const [remindersOpen, setRemindersOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customForm, setCustomForm] = useState({ title: '', dueAt: '', notes: '' });

  return (
    <>
      <div className="mt-4 mb-3">
        <button
          type="button"
          className="w-full text-left px-3 py-2 rounded-lg flex items-center justify-between"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
          onClick={() => setRemindersOpen(o => !o)}
        >
          <span className="font-medium text-sm">
            Promemoria e servizi ({tasksForBooking.filter(t => t.notify && !t.done).length} attivi)
          </span>
          <span>{remindersOpen ? '▴' : '▾'}</span>
        </button>
        {remindersOpen && (
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <div className="text-[11px] uppercase font-semibold mb-2" style={{ color: 'var(--ink-soft)' }}>Servizi opzionali</div>
              {tasksForBooking.filter(t => t.isService).map(t => (
                <div key={t.id} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={t.notify}
                    onChange={(e) => updateTask(t.id, { notify: e.target.checked })}
                  />
                  <span className="text-sm flex-1">{templates.find(x => x.id === t.templateId)?.serviceLabel || t.title}</span>
                  <input
                    type="time"
                    value={new Date(t.dueAt).toTimeString().slice(0, 5)}
                    onChange={(e) => {
                      const d = new Date(t.dueAt);
                      const [hh, mm] = e.target.value.split(':').map(Number);
                      d.setHours(hh, mm, 0, 0);
                      updateTask(t.id, { dueAt: d.toISOString() });
                    }}
                  />
                </div>
              ))}
            </div>

            <div>
              <div className="text-[11px] uppercase font-semibold mb-2" style={{ color: 'var(--ink-soft)' }}>Promemoria automatici</div>
              <TaskList
                tasks={tasksForBooking}
                mode="automatic"
                onToggleDone={toggleDoneTask}
                onEdit={(id) => setEditingTaskId(id)}
              />
            </div>

            {!showAddCustom ? (
              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={() => {
                  setCustomForm({
                    title: '',
                    dueAt: bookingCheckin ? `${bookingCheckin}T18:00` : '',
                    notes: '',
                  });
                  setShowAddCustom(true);
                }}
              >
                + Aggiungi promemoria personalizzato
              </button>
            ) : (
              <div className="p-3 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <input
                  type="text"
                  placeholder="Titolo"
                  value={customForm.title}
                  onChange={(e) => setCustomForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full mb-2"
                />
                <input
                  type="datetime-local"
                  value={customForm.dueAt}
                  onChange={(e) => setCustomForm(f => ({ ...f, dueAt: e.target.value }))}
                  className="w-full mb-2"
                />
                <textarea
                  placeholder="Note (opzionali)"
                  value={customForm.notes}
                  onChange={(e) => setCustomForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full mb-2"
                />
                <div className="flex gap-2 justify-end">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddCustom(false)}>Annulla</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!customForm.title || !customForm.dueAt}
                    onClick={() => {
                      const now = new Date().toISOString();
                      const newTask: BookingTask = {
                        id: uid('tk'),
                        bookingId,
                        templateId: null,
                        title: customForm.title,
                        dueAt: new Date(customForm.dueAt).toISOString(),
                        done: false,
                        notes: customForm.notes || undefined,
                        notify: true,
                        notificationStatus: 'pending',
                        isService: false,
                        createdAt: now,
                        updatedAt: now,
                      };
                      addTask(newTask);
                      setShowAddCustom(false);
                    }}
                  >
                    Aggiungi
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {editingTaskId && (() => {
        const task = tasksForBooking.find(t => t.id === editingTaskId);
        if (!task) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setEditingTaskId(null)}>
            <div className="w-full max-w-md p-4 rounded-t-2xl bg-[var(--surface)]" onClick={e => e.stopPropagation()}>
              <h3 className="font-semibold mb-3">Modifica promemoria</h3>
              <input
                type="text"
                value={task.title}
                onChange={(e) => updateTask(task.id, { title: e.target.value })}
                className="w-full mb-2"
                aria-label="Titolo"
              />
              <input
                type="datetime-local"
                value={new Date(task.dueAt).toISOString().slice(0, 16)}
                onChange={(e) => updateTask(task.id, { dueAt: new Date(e.target.value).toISOString() })}
                className="w-full mb-2"
              />
              <textarea
                value={task.notes || ''}
                onChange={(e) => updateTask(task.id, { notes: e.target.value })}
                className="w-full mb-2"
                placeholder="Note"
              />
              <label className="flex items-center gap-2 text-sm mb-3">
                <input
                  type="checkbox"
                  checked={task.notify}
                  onChange={(e) => updateTask(task.id, { notify: e.target.checked })}
                />
                Notifica abilitata
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-primary" onClick={() => setEditingTaskId(null)}>Chiudi</button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};
