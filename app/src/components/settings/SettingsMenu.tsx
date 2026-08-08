import { useState } from 'react';
import { TemplatesPage } from './TemplatesPage';
import { BackupSection } from './BackupSection';
import { CalendarSyncSection } from './CalendarSyncSection';
import { AccountSection } from './AccountSection';

type Section = 'menu' | 'reminders' | 'backup' | 'calendar' | 'account';

const ITEMS: { key: Exclude<Section, 'menu'>; icon: string; title: string; sub: string }[] = [
  { key: 'reminders', icon: '⏰', title: 'Promemoria e template', sub: 'Checklist automatiche per ogni prenotazione' },
  { key: 'backup', icon: '💾', title: 'Backup su Google Drive', sub: 'Esporta un backup completo dei dati' },
  { key: 'calendar', icon: '📅', title: 'Sync Google Calendar', sub: 'Condividi le prenotazioni su un calendario Google' },
  { key: 'account', icon: '👤', title: 'Account', sub: 'Email e disconnessione' },
];

export const SettingsMenu = ({ onBack }: { onBack: () => void }) => {
  const [section, setSection] = useState<Section>('menu');
  const toMenu = () => setSection('menu');

  if (section === 'reminders') return <TemplatesPage onBack={toMenu} />;
  if (section === 'backup') return <BackupSection onBack={toMenu} />;
  if (section === 'calendar') return <CalendarSyncSection onBack={toMenu} />;
  if (section === 'account') return <AccountSection onBack={toMenu} />;

  return (
    <div className="page-scroll">
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center mb-4">
          <button className="btn btn-ghost" onClick={onBack}>← Indietro</button>
          <h2 className="font-semibold flex-1 text-center">Impostazioni</h2>
        </div>
        <ul className="flex flex-col gap-2">
          {ITEMS.map(item => (
            <li key={item.key}>
              <button
                className="w-full text-left p-3 rounded-xl border flex items-center gap-3"
                style={{ borderColor: 'var(--line)' }}
                onClick={() => setSection(item.key)}
              >
                <span style={{ fontSize: 22 }}>{item.icon}</span>
                <span className="flex-1">
                  <span className="block font-medium text-sm">{item.title}</span>
                  <span className="block text-[11px]" style={{ color: 'var(--ink-soft)' }}>{item.sub}</span>
                </span>
                <span style={{ color: 'var(--ink-soft)' }}>›</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
