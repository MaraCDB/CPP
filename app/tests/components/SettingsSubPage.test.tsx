import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsSubPage } from '../../src/components/settings/SettingsSubPage';

describe('SettingsSubPage', () => {
  it('mostra il titolo e i children', () => {
    render(
      <SettingsSubPage title="Titolo di prova" onBack={() => {}}>
        <div>Contenuto figlio</div>
      </SettingsSubPage>,
    );
    expect(screen.getByText('Titolo di prova')).toBeInTheDocument();
    expect(screen.getByText('Contenuto figlio')).toBeInTheDocument();
  });

  it('bottone "← Indietro" chiama onBack', () => {
    const onBack = vi.fn();
    render(
      <SettingsSubPage title="Titolo di prova" onBack={onBack}>
        <div>Contenuto figlio</div>
      </SettingsSubPage>,
    );
    fireEvent.click(screen.getByText('← Indietro'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
