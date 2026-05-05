import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useBookings } from '../../store/bookings';
import { useClosures } from '../../store/closures';
import { useAuth } from '../../store/auth';
import { useTasks } from '../../store/tasks';
import { useTemplates } from '../../store/templates';
import { Modal } from '../common/Modal';
import { ChipGroup } from '../common/ChipGroup';
import { TaskList } from '../common/TaskList';
import { checkConflicts } from '../../lib/conflicts';
import { nightsBetween } from '../../lib/date';
import { uid } from '../../lib/id';
import type { Prenotazione, Camera, Stato, ContattoVia, AnticipoTipo, BookingTask } from '../../types';
import { toE164 } from '../../lib/phone';
import { searchByPhone, createContact, ScopeError } from '../../lib/google/people';
import { ConfirmCreateContactModal } from '../common/ConfirmCreateContactModal';

interface Props { id?: string; prefillCheckin?: string; onClose: () => void; }

const empty = (prefillCheckin?: string): Partial<Prenotazione> => ({
  camera: 'lampone', checkin: prefillCheckin || '', checkout: '',
  nome: '', stato: 'proposta', numOspiti: 2,
});

export const BookingForm = ({ id, prefillCheckin, onClose }: Props) => {
  const readonly = useAuth(s => s.readonly);
  const { items, add, update, remove } = useBookings();
  const closures = useClosures(s => s.items);
  const existing = id ? items.find(b => b.id === id) : undefined;
  const [data, setData] = useState<Partial<Prenotazione>>(existing || empty(prefillCheckin));
  const [warn, setWarn] = useState<{ msg: string; block: boolean } | null>(null);
  const ackRef = useRef(false);
  const [antTouched, setAntTouched] = useState(!!existing?.anticipo?.importo);
  const [pendingConfirm, setPendingConfirm] = useState<{
    candidate: Prenotazione;
    e164: string;
  } | null>(null);

  const tasksForBooking = useTasks(s => existing ? s.byBooking(existing.id) : []);
  const updateTask = useTasks(s => s.update);
  const toggleDoneTask = useTasks(s => s.toggleDone);
  const addTask = useTasks(s => s.add);
  const templates = useTemplates(s => s.items);

  const [remindersOpen, setRemindersOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customForm, setCustomForm] = useState({ title: '', dueAt: '', notes: '' });

  // reset ack quando cambiano dati rilevanti
  useEffect(() => { ackRef.current = false; setWarn(null); },
    [data.camera, data.checkin, data.checkout, data.stato]);

  // auto-calcola anticipo 35%
  useEffect(() => {
    if (data.prezzoTotale && !antTouched) {
      setData(d => ({
        ...d,
        anticipo: { ...(d.anticipo || { tipo: undefined }), importo: Math.round((data.prezzoTotale || 0) * 0.35) } as Prenotazione['anticipo'],
      }));
    }
  }, [data.prezzoTotale, antTouched]);

  if (readonly) return null;

  const set = <K extends keyof Prenotazione>(k: K, v: Prenotazione[K]) => setData(d => ({ ...d, [k]: v }));
  const setAnticipo = (patch: Partial<NonNullable<Prenotazione['anticipo']>>) =>
    setData(d => ({ ...d, anticipo: { ...(d.anticipo || { importo: 0 }), ...patch } as Prenotazione['anticipo'] }));

  const nights = data.checkin && data.checkout && data.checkout > data.checkin ? nightsBetween(data.checkin, data.checkout) : 0;

  const finalize = (candidate: Prenotazione) => {
    const { id: _id, creatoIl: _c, aggiornatoIl: _u, ...rest } = candidate; // eslint-disable-line @typescript-eslint/no-unused-vars
    if (existing) update(existing.id, rest);
    else add(rest);
    onClose();
  };

  const resolveContact = async (candidate: Prenotazione): Promise<Prenotazione> => {
    if (candidate.contattoVia !== 'telefono' || !candidate.contattoValore) return candidate;
    const e164 = toE164(candidate.contattoValore);
    if (!e164) return candidate;
    const numberChanged = !existing || toE164(existing.contattoValore || '') !== e164;
    if (!numberChanged && candidate.contattoResourceName) return candidate;
    try {
      const match = await searchByPhone(e164);
      if (match) {
        return { ...candidate, contattoResourceName: match.resourceName, contattoEmail: match.email };
      }
      setPendingConfirm({ candidate, e164 });
      throw new Error('__PENDING_CONFIRM__');
    } catch (err) {
      if (err instanceof Error && err.message === '__PENDING_CONFIRM__') throw err;
      if (err instanceof ScopeError) {
        alert('Serve ri-autorizzare l\u2019accesso ai contatti Gmail. Esci e rientra.');
        return candidate;
      }
      console.warn('People lookup failed, saving without contact link', err);
      return candidate;
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!data.checkin || !data.checkout || (data.checkout <= data.checkin)) {
      alert('Il check-out deve essere dopo il check-in'); return;
    }
    const candidate: Prenotazione = {
      id: existing?.id || 'tmp',
      creatoIl: existing?.creatoIl || new Date().toISOString(),
      aggiornatoIl: new Date().toISOString(),
      camera: (data.camera || 'lampone') as Camera,
      checkin: data.checkin, checkout: data.checkout,
      stato: (data.stato || 'proposta') as Stato,
      nome: (data.nome || '').trim(),
      riferimento: data.riferimento?.trim() || undefined,
      numOspiti: data.numOspiti || 2,
      contattoVia: data.contattoVia,
      contattoValore: data.contattoValore?.trim() || undefined,
      prezzoTotale: data.prezzoTotale || undefined,
      anticipo: data.anticipo?.importo ? { importo: data.anticipo.importo, data: data.anticipo.data, tipo: data.anticipo.tipo } : undefined,
      note: data.note?.trim() || undefined,
      contattoResourceName: existing?.contattoResourceName,
      contattoEmail: existing?.contattoEmail,
    };
    const conf = checkConflicts(candidate, items, closures);
    if (conf?.block) { setWarn(conf); ackRef.current = false; return; }
    if (conf && !ackRef.current) { setWarn(conf); ackRef.current = true; return; }

    try {
      const resolved = await resolveContact(candidate);
      finalize(resolved);
    } catch (err) {
      if (err instanceof Error && err.message === '__PENDING_CONFIRM__') return;
      throw err;
    }
  };

  const onDelete = () => {
    if (!existing) return;
    if (!confirm(`Eliminare la prenotazione di "${existing.nome}"?`)) return;
    remove(existing.id);
    onClose();
  };

  const handleConfirmCreate = async () => {
    if (!pendingConfirm) return;
    const { candidate, e164 } = pendingConfirm;
    setPendingConfirm(null);
    try {
      const created = await createContact({ name: candidate.nome, phoneE164: e164 });
      finalize({ ...candidate, contattoResourceName: created.resourceName, contattoEmail: created.email });
    } catch (err) {
      console.warn('createContact failed', err);
      finalize(candidate);
    }
  };

  const handleSkipCreate = () => {
    if (!pendingConfirm) return;
    const { candidate } = pendingConfirm;
    setPendingConfirm(null);
    finalize(candidate);
  };

  return (
    <Modal open onClose={onClose} title={existing ? 'Modifica prenotazione' : 'Nuova prenotazione'}>
      <form onSubmit={(e) => { void onSubmit(e); }} className="p-4">
        <label className="field">
          <span>Camera</span>
          <ChipGroup<Camera>
            options={[{value:'lampone',label:'🍇 Lampone'},{value:'mirtillo',label:'🫐 Mirtillo'}]}
            value={data.camera} onChange={(v) => set('camera', v)} />
        </label>
        <div className="row2">
          <label className="field"><span>Check-in</span>
            <input type="date" required value={data.checkin || ''} onChange={(e) => set('checkin', e.target.value)} /></label>
          <label className="field"><span>Check-out</span>
            <input type="date" required value={data.checkout || ''} onChange={(e) => set('checkout', e.target.value)} /></label>
        </div>
        {nights > 0 && <div className="text-[12px] -mt-2 mb-3" style={{ color: 'var(--ink-soft)' }}>{nights} notti</div>}
        <div className="row2">
          <label className="field"><span>Nome ospite</span>
            <input type="text" required value={data.nome || ''} onChange={(e) => set('nome', e.target.value)} placeholder="es. Rossi" /></label>
          <label className="field"><span>Riferimento</span>
            <input type="text" value={data.riferimento || ''} onChange={(e) => set('riferimento', e.target.value)} placeholder="es. #12 / Booking" /></label>
        </div>
        <div className="row2">
          <label className="field"><span>N° ospiti</span>
            <input type="number" min={1} max={4} value={data.numOspiti || 2} onChange={(e) => set('numOspiti', Number(e.target.value))} /></label>
          <label className="field"><span>Stato</span>
            <select value={data.stato || 'proposta'} onChange={(e) => set('stato', e.target.value as Stato)}>
              <option value="proposta">Proposta</option>
              <option value="anticipo_atteso">Anticipo atteso</option>
              <option value="confermato">Confermato</option>
            </select></label>
        </div>
        <label className="field"><span>Come ti hanno contattato</span>
          <ChipGroup<ContattoVia>
            options={[
              {value:'telefono',label:'📞 Telefono'},
              {value:'whatsapp',label:'💬 WhatsApp'},
              {value:'mail',label:'✉️ Mail'},
              {value:'ota',label:'🌐 OTA'},
            ]}
            value={data.contattoVia} onChange={(v) => set('contattoVia', v)} />
        </label>
        <label className="field"><span>Recapito (tel / email)</span>
          <input type="text" value={data.contattoValore || ''} onChange={(e) => set('contattoValore', e.target.value)} placeholder="+39..." /></label>
        <div className="row2">
          <label className="field"><span>Prezzo totale (€)</span>
            <input type="number" min={0} step={1} value={data.prezzoTotale || ''} onChange={(e) => set('prezzoTotale', Number(e.target.value) || (undefined as unknown as number))} placeholder="0" /></label>
          <label className="field"><span>Anticipo 35% (€)</span>
            <input type="number" min={0} step={1} value={data.anticipo?.importo || ''} onChange={(e) => { setAntTouched(true); setAnticipo({ importo: Number(e.target.value) || 0 }); }} placeholder="auto" /></label>
        </div>
        <div className="row2">
          <label className="field"><span>Data anticipo</span>
            <input type="date" value={data.anticipo?.data || ''} onChange={(e) => setAnticipo({ data: e.target.value })} /></label>
          <label className="field"><span>Tipo anticipo</span>
            <select value={data.anticipo?.tipo || ''} onChange={(e) => setAnticipo({ tipo: (e.target.value || undefined) as AnticipoTipo })}>
              <option value="">—</option>
              <option value="bonifico">Bonifico</option>
              <option value="sito_bb">Sito B&B</option>
              <option value="ota">OTA (Booking/Airbnb)</option>
            </select></label>
        </div>
        <label className="field"><span>Note</span>
          <textarea value={data.note || ''} onChange={(e) => set('note', e.target.value)} placeholder="Allergie, orario arrivo, richieste..." /></label>
        {warn && <div className="p-3 rounded-lg mb-3" style={{
          background: warn.block ? 'var(--danger-bg)' : 'var(--banner-bg)',
          color: warn.block ? 'var(--danger-text)' : 'var(--banner-text)', fontSize: 13,
        }}>{warn.msg}{!warn.block && ' · Salva di nuovo per confermare.'}</div>}

        {existing && (
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
                        dueAt: data.checkin ? `${data.checkin}T18:00` : '',
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
                          if (!existing) return;
                          const now = new Date().toISOString();
                          const newTask: BookingTask = {
                            id: uid('tk'),
                            bookingId: existing.id,
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
        )}

        <div className="flex justify-between items-center mt-4">
          {existing ? <button type="button" className="btn btn-danger" onClick={onDelete}>Elimina</button> : <span />}
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary">Salva</button>
          </div>
        </div>
      </form>
        {pendingConfirm && (
          <ConfirmCreateContactModal
            open
            name={pendingConfirm.candidate.nome}
            phoneE164={pendingConfirm.e164}
            onConfirm={handleConfirmCreate}
            onSkip={handleSkipCreate}
          />
        )}
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
    </Modal>
  );
};
