import { useState } from 'react';
import { listCalendars, CalendarScopeError, type GoogleCalendarListEntry } from '../../lib/google/calendarSync';
import { useCalendarSettings } from '../../store/calendarSettings';

export const CalendarSyncSection = () => {
  const calendarId = useCalendarSettings(s => s.googleCalendarId);
  const calendarName = useCalendarSettings(s => s.googleCalendarName);
  const enabled = useCalendarSettings(s => s.calendarSyncEnabled);
  const setCalendar = useCalendarSettings(s => s.setCalendar);
  const setEnabled = useCalendarSettings(s => s.setEnabled);
  const disconnect = useCalendarSettings(s => s.disconnect);

  const [choosing, setChoosing] = useState(false);
  const [options, setOptions] = useState<GoogleCalendarListEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const onConnect = async () => {
    setErr(null);
    try {
      setOptions(await listCalendars());
      setChoosing(true);
    } catch (e) {
      setErr(e instanceof CalendarScopeError
        ? 'Riconnetti l’account Google per accedere a Calendar (sessione scaduta).'
        : 'Impossibile leggere i calendari.');
    }
  };

  return (
    <section className="mt-6">
      <h3 className="font-semibold mb-2">Sync Google Calendar</h3>
      {calendarId ? (
        <>
          <div className="text-sm mb-2">Connesso a «{calendarName}»</div>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
            Sync attivo
          </label>
          <button className="btn btn-ghost" onClick={disconnect}>Disconnetti</button>
        </>
      ) : (
        <>
          <div className="text-sm mb-2" style={{ color: 'var(--ink-soft)' }}>Non connesso</div>
          <button className="btn btn-primary mb-2" onClick={() => void onConnect()}>Connetti calendario</button>
        </>
      )}
      {err && <div className="text-xs mb-2" style={{ color: 'crimson' }}>{err}</div>}
      {choosing && (
        <ul className="flex flex-col gap-1 text-sm">
          {options.map(o => (
            <li key={o.id}>
              <button className="btn btn-ghost" onClick={() => { setCalendar(o.id, o.summary); setChoosing(false); }}>
                {o.summary}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
