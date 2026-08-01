import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('../../src/lib/firebase/auth', () => ({ auth: { currentUser: null } }));
vi.mock('../../src/lib/firebase/db', () => ({
  upsertDoc: vi.fn().mockResolvedValue(undefined),
  removeDoc: vi.fn().mockResolvedValue(undefined),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { TodoPanel } from '../../src/components/panels/TodoPanel';
import { useBookings } from '../../src/store/bookings';
import { usePromemoria } from '../../src/store/promemoria';
import { useTasks } from '../../src/store/tasks';
import type { BookingTask, Prenotazione } from '../../src/types';

const booking = (over: Partial<Prenotazione>): Prenotazione => ({
  id: 'b1', camera: 'lampone', checkin: '2020-01-01', checkout: '2020-01-02',
  stato: 'confermato', nome: 'Rossi',
  creatoIl: '2020-01-01T00:00:00.000Z', aggiornatoIl: '2020-01-01T00:00:00.000Z',
  ...over,
});

const task = (over: Partial<BookingTask>): BookingTask => ({
  id: 't1', bookingId: 'b1', templateId: null, title: 'Richiedi documenti',
  dueAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), done: false, notify: true,
  notificationStatus: 'pending', isService: false,
  createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z',
  ...over,
});

describe('TodoPanel - promemoria scaduti', () => {
  beforeEach(() => {
    useBookings.setState({ items: [booking({})] });
    usePromemoria.setState({ items: [] });
    useTasks.setState({ items: [task({})] });
  });

  it('mostra i promemoria scaduti con il nome della prenotazione', () => {
    render(<TodoPanel onClose={() => {}} />);
    expect(screen.getByText(/Richiedi documenti/)).toBeInTheDocument();
    expect(screen.getByText(/Rossi/)).toBeInTheDocument();
  });

  it('non mostra i task gia fatti o non ancora scaduti', () => {
    useTasks.setState({
      items: [
        task({ id: 't2', title: 'Fatto', done: true }),
        task({ id: 't3', title: 'Futuro', dueAt: '2099-01-01T00:00:00.000Z' }),
      ],
    });
    render(<TodoPanel onClose={() => {}} />);
    expect(screen.queryByText(/Fatto/)).toBeNull();
    expect(screen.queryByText(/Futuro/)).toBeNull();
  });

  it('la checkbox del promemoria scaduto chiama toggleDone', () => {
    render(<TodoPanel onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Segna Richiedi documenti/));
    expect(useTasks.getState().items.find(t => t.id === 't1')?.done).toBe(true);
  });
});
