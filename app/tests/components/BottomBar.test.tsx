import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BottomBar } from '../../src/components/calendar/BottomBar';
import { useBookings } from '../../src/store/bookings';
import { usePromemoria } from '../../src/store/promemoria';
import { useTasks } from '../../src/store/tasks';
import type { BookingTask } from '../../src/types';

const task = (over: Partial<BookingTask>): BookingTask => ({
  id: 't1', bookingId: 'b1', templateId: null, title: 'X',
  dueAt: '2020-01-01T08:00:00.000Z', done: false, notify: true,
  notificationStatus: 'pending', isService: false,
  createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z',
  ...over,
});

describe('BottomBar - badge Da fare', () => {
  beforeEach(() => {
    useBookings.setState({ items: [] });
    usePromemoria.setState({ items: [] });
    useTasks.setState({ items: [] });
  });

  it('include i promemoria automatici scaduti nel conteggio', () => {
    useTasks.setState({ items: [task({})] });
    render(<BottomBar />);
    expect(screen.getByRole('button', { name: /Da fare/i })).toHaveTextContent('1');
  });

  it('non conta i task non ancora scaduti', () => {
    useTasks.setState({ items: [task({ dueAt: '2099-01-01T00:00:00.000Z' })] });
    render(<BottomBar />);
    expect(screen.getByRole('button', { name: /Da fare/i })).toHaveTextContent('0');
  });
});
