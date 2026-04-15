import type { Vista } from '../../types';
const VIEWS: { v: Vista; full: string; short: string }[] = [
  { v: 'mese', full: 'Mese', short: 'M' },
  { v: 'trim', full: 'Trim', short: 'T' },
  { v: 'sem',  full: 'Sem',  short: 'S' },
  { v: 'anno', full: 'Anno', short: 'A' },
];
export const ViewSwitch = ({ value, onChange }: { value: Vista; onChange: (v: Vista) => void }) => (
  <div className="view-switch">
    {VIEWS.map(({v, full, short}) => (
      <button key={v} className={value === v ? 'active' : ''} onClick={() => onChange(v)}>
        <span className="full">{full}</span><span className="short">{short}</span>
      </button>
    ))}
  </div>
);
