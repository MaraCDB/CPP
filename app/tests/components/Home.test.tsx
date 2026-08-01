import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Home } from '../../src/components/Home';
import { useBookings } from '../../src/store/bookings';
import { usePromemoria } from '../../src/store/promemoria';
import { useUI } from '../../src/store/ui';
import { useTasks } from '../../src/store/tasks';
import type { BookingTask } from '../../src/types';

describe('Home', () => {
  beforeEach(() => {
    useBookings.setState({ items: [] });
    usePromemoria.setState({ items: [] });
    useUI.setState({ page: 'home', side: null, modal: null });
    useTasks.setState({ items: [] });
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

  const overdueTask = (over: Partial<BookingTask>): BookingTask => ({
    id: 't1', bookingId: 'b1', templateId: null, title: 'Richiedi documenti',
    dueAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), done: false, notify: true,
    notificationStatus: 'pending', isService: false,
    createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z',
    ...over,
  });

  it('non mostra il banner scaduti se non ci sono task scaduti', () => {
    render(<Home />);
    expect(screen.queryByText(/promemoria scadut/i)).toBeNull();
  });

  it('mostra il banner scaduti con il conteggio corretto', () => {
    useTasks.setState({ items: [overdueTask({})] });
    render(<Home />);
    expect(screen.getByText(/1 promemoria scaduto/i)).toBeInTheDocument();
  });

  it('il click sul banner scaduti apre il calendario sul pannello Da fare', () => {
    useTasks.setState({ items: [overdueTask({})] });
    render(<Home />);
    fireEvent.click(screen.getByText(/1 promemoria scaduto/i));
    expect(useUI.getState().page).toBe('calendar');
    expect(useUI.getState().side).toEqual({ kind: 'todo' });
  });
});
