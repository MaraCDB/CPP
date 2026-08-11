import { useState } from 'react';
import { listCalendars, CalendarScopeError, type GoogleCalendarListEntry } from '../../lib/google/calendarSync';
import { useCalendarSettings } from '../../store/calendarSettings';
import { signIn } from '../../lib/firebase/auth';
import { enqueue } from '../../lib/google/calendarQueue';
import { useBookings } from '../../store/bookings';
import { useClosures } from '../../store/closures';
import { runCalendarSyncQueueNow } from '../../hooks/useCalendarSyncQueue';
import { SettingsSubPage } from './SettingsSubPage';

export const CalendarSyncSection = ({ onBack }: { onBack: () => void }) => {
  const calendarId = useCalendarSettings(s => s.googleCalendarId);
  const calendarName = useCalendarSettings(s => s.googleCalendarName);
  const enabled = useCalendarSettings(s => s.calendarSyncEnabled);
  const setCalendar = useCalendarSettings(s => s.setCalendar);
  const setEnabled = useCalendarSettings(s => s.setEnabled);
  const disconnect = useCalendarSettings(s => s.disconnect);

  const [choosing, setChoosing] = useState(false);
  const [options, setOptions] = useState<GoogleCalendarListEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const onConnect = async () => {
    setErr(null);
    try {
      setOptions(await listCalendars());
      setChoosing(true);
      setExpired(false);
    } catch (e) {
      const scopeError = e instanceof CalendarScopeError;
      setExpired(scopeError);
      setErr(scopeError
        ? 'Riconnetti l’account Google per accedere a Calendar (sessione scaduta).'
        : 'Impossibile leggere i calendari.');
    }
  };

  const onReconnect = async () => {
    setErr(null);
    try {
      await signIn();
      setExpired(false);
      runCalendarSyncQueueNow();
      // Da non connesso il riconnetti serve proprio a poter scegliere il calendario.
      if (!calendarId) await onConnect();
    } catch {
      setErr('Impossibile riconnettere l’account Google.');
    }
  };

  return (
    <SettingsSubPage title="Sync Google Calendar" onBack={onBack}>
      {calendarId ? (
        <>
          <div className="text-sm mb-2">Connesso a «{calendarName}»</div>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
            Sync attivo
          </label>
          <button className="btn btn-ghost" onClick={() => void onReconnect()}>Riconnetti Google</button>
          <button className="btn btn-ghost" onClick={disconnect}>Disconnetti</button>
        </>
      ) : (
        <>
          <div className="text-sm mb-2" style={{ color: 'var(--ink-soft)' }}>Non connesso</div>
          <button className="btn btn-primary mb-2" onClick={() => void onConnect()}>Connetti calendario</button>
          {expired && (
            <button className="btn btn-ghost mb-2" onClick={() => void onReconnect()}>Riconnetti Google</button>
          )}
        </>
      )}
      {err && <div className="text-xs mb-2" style={{ color: 'crimson' }}>{err}</div>}
      {choosing && (
        <ul className="flex flex-col gap-1 text-sm">
          {options.map(o => (
            <li key={o.id}>
              <button className="btn btn-ghost" onClick={() => {
                setCalendar(o.id, o.summary);
                useBookings.getState().items.forEach(b => enqueue('booking', b.id, 'upsert'));
                useClosures.getState().items.forEach(c => enqueue('closure', c.id, 'upsert'));
                runCalendarSyncQueueNow();
                setChoosing(false);
              }}>
                {o.summary}
              </button>
            </li>
          ))}
        </ul>
      )}
    </SettingsSubPage>
  );
};
