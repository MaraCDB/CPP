import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Home } from '../../src/components/Home';
import { useBookings } from '../../src/store/bookings';
import { usePromemoria } from '../../src/store/promemoria';
import { useUI } from '../../src/store/ui';

describe('Home', () => {
  beforeEach(() => {
    useBookings.setState({ items: [] });
    usePromemoria.setState({ items: [] });
    useUI.setState({ page: 'home', side: null, modal: null });
  });

  it('non mostra il bottone "Da fare"', () => {
    render(<Home />);
    expect(screen.queryByRole('button', { name: /Da fare/i })).toBeNull();
  });

  it('mostra Calendario, Arrivi e Impostazioni', () => {
    render(<Home />);
    expect(screen.getByRole('button', { name: /Calendario/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Arrivi/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Impostazioni/i })).toBeInTheDocument();
  });

  it('non mostra il vecchio nome "Promemoria" come bottone home', () => {
    render(<Home />);
    expect(screen.queryByRole('button', { name: /^Promemoria$/i })).toBeNull();
  });
});
