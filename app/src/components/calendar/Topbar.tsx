import { useSettings } from '../../store/settings';
import { useUI } from '../../store/ui';
import { ViewSwitch } from './ViewSwitch';
import { ThemeToggle } from '../ThemeToggle';
import { SyncIndicator } from '../SyncIndicator';
import { MONTHS, MONTHS_SHORT, parseISO, iso } from '../../lib/date';

const MONTHS_COUNT = { mese: 1, trim: 3, sem: 6, anno: 12 } as const;

export const Topbar = () => {
  const { vista, setVista, anchor, setAnchor, shiftAnchor } = useSettings();
  const goHome = useUI(s => s.goHome);
  const a = parseISO(anchor);
  const y = a.getFullYear(), m = a.getMonth();
  const count = MONTHS_COUNT[vista];
  const label = vista === 'mese'
    ? `${MONTHS[m]} ${y}`
    : vista === 'anno'
      ? String(y)
      : `${MONTHS_SHORT[m]} → ${MONTHS_SHORT[(m + count - 1) % 12]} ${new Date(y, m + count - 1, 1).getFullYear()}`;
  const today = () => setAnchor(iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));

  return (
    <header id="topbar" className="flex items-center justify-between px-4 py-3 border-b flex-wrap gap-2"
      style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
      <div className="flex items-center gap-2">
        <button className="btn btn-ghost !p-2" onClick={goHome} title="Home">🏠</button>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
             style={{ background: 'linear-gradient(135deg,var(--lampone),var(--mirtillo))' }}>🏡</div>
        <div>
          <div className="font-semibold text-sm leading-tight">Cuore di Bosco</div>
          <div className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Calendario prenotazioni</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ViewSwitch value={vista} onChange={setVista} />
        <button className="btn btn-ghost !p-2" onClick={() => shiftAnchor(-MONTHS_COUNT[vista])}>◀</button>
        <div className="text-sm font-semibold min-w-[90px] text-center">{label}</div>
        <button className="btn btn-ghost !p-2" onClick={() => shiftAnchor(MONTHS_COUNT[vista])}>▶</button>
        <button className="btn btn-ghost hidden sm:inline-block" onClick={today}>Oggi</button>
        <ThemeToggle />
        <SyncIndicator />
      </div>
    </header>
  );
};
