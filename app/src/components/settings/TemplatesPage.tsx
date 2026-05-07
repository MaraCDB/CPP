import { useState, useEffect } from 'react';
import { useTemplates } from '../../store/templates';
import { GenerateRemindersButton } from './GenerateRemindersButton';
import type { ReminderTemplate } from '../../types';
import { buildZipBytes } from '../../lib/firebase/backup';
import {
  uploadToDrive, listDriveBackups, markBackupNow, lastBackupAt,
  DriveScopeError, type DriveBackupMeta,
} from '../../lib/google/driveBackup';

const previewTitle = (title: string) =>
  title.replace('{adulti}', '2').replace('{bambini}', '1').replace('{oraArrivo}', '15:30');

export const TemplatesPage = ({ onBack }: { onBack: () => void }) => {
  const items = useTemplates(s => s.items);
  const upsert = useTemplates(s => s.upsert);
  const remove = useTemplates(s => s.remove);
  const toggleEnabled = useTemplates(s => s.toggleEnabled);
  const [editing, setEditing] = useState<ReminderTemplate | null>(null);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center mb-4">
        <button className="btn btn-ghost" onClick={onBack}>← Indietro</button>
        <h2 className="font-semibold flex-1 text-center">Promemoria e template</h2>
      </div>

      <ul className="flex flex-col gap-2 mb-4">
        {[...items].sort((a, b) => a.sortOrder - b.sortOrder).map(t => (
          <li key={t.id} className="p-3 rounded-xl border" style={{ borderColor: 'var(--line)', opacity: t.enabled ? 1 : 0.5 }}>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={t.enabled} onChange={() => toggleEnabled(t.id)} aria-label={`Abilita ${t.title}`} />
              <div className="flex-1">
                <div className="font-medium text-sm">{previewTitle(t.title)}</div>
                <div className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                  {t.anchor === 'check-in' ? 'Check-in' : 'Check-out'}{t.offsetDays > 0 ? ` +${t.offsetDays}` : t.offsetDays < 0 ? ` ${t.offsetDays}` : ''} · {t.defaultTime}
                  {t.isService && ' · servizio'}
                </div>
              </div>
              <button className="btn btn-ghost text-[12px]" onClick={() => setEditing(t)}>✏️</button>
              {!t.builtIn && (
                <button className="btn btn-ghost text-[12px]" onClick={() => remove(t.id)}>🗑️</button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <button className="btn btn-primary mb-4" onClick={() => setEditing({
        id: 'custom_' + Date.now(), builtIn: false, enabled: true,
        title: '', isService: false, anchor: 'check-in', offsetDays: 0,
        defaultTime: '09:00', notify: true, sortOrder: 1000,
      })}>
        + Nuovo template
      </button>

      <GenerateRemindersButton />

      <BackupSection />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md p-4 rounded-t-2xl bg-[var(--surface)]" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">Modifica template</h3>
            <label className="field"><span>Titolo</span>
              <input type="text" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
            </label>
            <div className="text-[11px] mb-2" style={{ color: 'var(--ink-soft)' }}>
              Anteprima: {previewTitle(editing.title)}
            </div>
            <label className="field"><span>Orario default</span>
              <input type="time" value={editing.defaultTime} onChange={e => setEditing({ ...editing, defaultTime: e.target.value })} />
            </label>
            {!editing.builtIn && (
              <>
                <label className="field"><span>Ancorato a</span>
                  <select value={editing.anchor} onChange={e => setEditing({ ...editing, anchor: e.target.value as 'check-in' | 'check-out' })}>
                    <option value="check-in">Check-in</option>
                    <option value="check-out">Check-out</option>
                  </select>
                </label>
                <label className="field"><span>Offset giorni</span>
                  <input type="number" value={editing.offsetDays} onChange={e => setEditing({ ...editing, offsetDays: Number(e.target.value) })} />
                </label>
              </>
            )}
            <label className="flex items-center gap-2 text-sm mb-2">
              <input type="checkbox" checked={editing.isService} onChange={e => setEditing({ ...editing, isService: e.target.checked })} />
              È un servizio (compare come checkbox nel form)
            </label>
            <label className="flex items-center gap-2 text-sm mb-3">
              <input type="checkbox" checked={editing.notify} onChange={e => setEditing({ ...editing, notify: e.target.checked })} />
              Genera notifica
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Annulla</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!editing.title}
                onClick={() => { upsert(editing); setEditing(null); }}
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

const BackupSection = () => {
  const [items, setItems] = useState<DriveBackupMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const last = lastBackupAt();
  const stale = !last || Date.now() - last > SEVEN_DAYS;

  const refresh = async () => {
    try { setItems(await listDriveBackups()); setErr(null); }
    catch (e) {
      if (e instanceof DriveScopeError) setErr('Riconnetti l’account Google per accedere al Drive (sessione scaduta).');
      else setErr('Impossibile leggere la lista backup.');
    }
  };

  useEffect(() => { void refresh(); }, []);

  const onCreate = async () => {
    setBusy(true); setErr(null);
    try {
      const bytes = await buildZipBytes();
      const today = new Date().toISOString().slice(0, 10);
      await uploadToDrive(`cdb-backup-${today}.zip`, bytes);
      markBackupNow();
      await refresh();
    } catch (e) {
      if (e instanceof DriveScopeError) setErr('Riconnetti l’account Google: serve il consenso Drive per il backup.');
      else setErr('Backup fallito. Riprova.');
    } finally { setBusy(false); }
  };

  const onOpen = (id: string) => {
    window.open(`https://drive.google.com/file/d/${id}/view`, '_blank');
  };

  return (
    <section className="mt-6">
      <h3 className="font-semibold mb-2">Backup su Google Drive</h3>
      {stale && (
        <div className="text-xs mb-2" style={{ color: 'var(--ink-soft)' }}>
          {last ? 'L’ultimo backup risale a oltre 7 giorni fa.' : 'Nessun backup ancora creato.'}
        </div>
      )}
      <button className="btn btn-primary mb-2" disabled={busy} onClick={() => void onCreate()}>
        {busy ? 'Esportazione…' : 'Esporta backup ora'}
      </button>
      {err && <div className="text-xs mb-2" style={{ color: 'crimson' }}>{err}</div>}
      <ul className="flex flex-col gap-1 text-sm">
        {items.map(m => (
          <li key={m.id} className="flex items-center gap-2">
            <span className="flex-1">{m.name}</span>
            <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
              {(m.size / 1024).toFixed(1)} kB
            </span>
            <button className="btn btn-ghost text-xs" onClick={() => onOpen(m.id)}>Apri</button>
          </li>
        ))}
        {items.length === 0 && !err && (
          <li className="text-xs" style={{ color: 'var(--ink-soft)' }}>Nessun backup su Drive.</li>
        )}
      </ul>
    </section>
  );
};
