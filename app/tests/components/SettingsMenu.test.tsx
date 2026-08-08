import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../src/components/settings/TemplatesPage', () => ({
  TemplatesPage: ({ onBack }: { onBack: () => void }) => (
    <div>
      <span>Pagina Promemoria</span>
      <button onClick={onBack}>indietro-reminders</button>
    </div>
  ),
}));
vi.mock('../../src/components/settings/BackupSection', () => ({
  BackupSection: ({ onBack }: { onBack: () => void }) => (
    <div>
      <span>Pagina Backup</span>
      <button onClick={onBack}>indietro-backup</button>
    </div>
  ),
}));
vi.mock('../../src/components/settings/CalendarSyncSection', () => ({
  CalendarSyncSection: ({ onBack }: { onBack: () => void }) => (
    <div>
      <span>Pagina Calendar</span>
      <button onClick={onBack}>indietro-calendar</button>
    </div>
  ),
}));
vi.mock('../../src/components/settings/AccountSection', () => ({
  AccountSection: ({ onBack }: { onBack: () => void }) => (
    <div>
      <span>Pagina Account</span>
      <button onClick={onBack}>indietro-account</button>
    </div>
  ),
}));

import { SettingsMenu } from '../../src/components/settings/SettingsMenu';

describe('SettingsMenu', () => {
  it('mostra le 4 voci del menu', () => {
    render(<SettingsMenu onBack={() => {}} />);
    expect(screen.getByText('Promemoria e template')).toBeInTheDocument();
    expect(screen.getByText('Backup su Google Drive')).toBeInTheDocument();
    expect(screen.getByText('Sync Google Calendar')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('bottone "← Indietro" del menu chiama onBack', () => {
    const onBack = vi.fn();
    render(<SettingsMenu onBack={onBack} />);
    fireEvent.click(screen.getByText('← Indietro'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('naviga a "Promemoria e template" e torna al menu', () => {
    render(<SettingsMenu onBack={() => {}} />);
    fireEvent.click(screen.getByText('Promemoria e template'));
    expect(screen.getByText('Pagina Promemoria')).toBeInTheDocument();
    fireEvent.click(screen.getByText('indietro-reminders'));
    expect(screen.getByText('Promemoria e template')).toBeInTheDocument();
  });

  it('naviga a "Backup su Google Drive" e torna al menu', () => {
    render(<SettingsMenu onBack={() => {}} />);
    fireEvent.click(screen.getByText('Backup su Google Drive'));
    expect(screen.getByText('Pagina Backup')).toBeInTheDocument();
    fireEvent.click(screen.getByText('indietro-backup'));
    expect(screen.getByText('Backup su Google Drive')).toBeInTheDocument();
  });

  it('naviga a "Sync Google Calendar" e torna al menu', () => {
    render(<SettingsMenu onBack={() => {}} />);
    fireEvent.click(screen.getByText('Sync Google Calendar'));
    expect(screen.getByText('Pagina Calendar')).toBeInTheDocument();
    fireEvent.click(screen.getByText('indietro-calendar'));
    expect(screen.getByText('Sync Google Calendar')).toBeInTheDocument();
  });

  it('naviga a "Account" e torna al menu', () => {
    render(<SettingsMenu onBack={() => {}} />);
    fireEvent.click(screen.getByText('Account'));
    expect(screen.getByText('Pagina Account')).toBeInTheDocument();
    fireEvent.click(screen.getByText('indietro-account'));
    expect(screen.getByText('Account')).toBeInTheDocument();
  });
});
