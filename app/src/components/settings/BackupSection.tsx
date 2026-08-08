import { useState, useEffect } from 'react';
import { SettingsSubPage } from './SettingsSubPage';
import { buildZipBytes } from '../../lib/firebase/backup';
import {
  uploadToDrive, listDriveBackups, markBackupNow, lastBackupAt,
  DriveScopeError, type DriveBackupMeta,
} from '../../lib/google/driveBackup';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export const BackupSection = ({ onBack }: { onBack: () => void }) => {
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
    <SettingsSubPage title="Backup su Google Drive" onBack={onBack}>
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
    </SettingsSubPage>
  );
};
