import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskList } from '../../src/components/common/TaskList';
import type { BookingTask } from '../../src/types';

const t = (over: Partial<BookingTask>): BookingTask => ({
  id: 'a', bookingId: 'b1', templateId: 'preparation',
  title: 'Prepara camera', dueAt: '2026-05-09T14:00:00.000Z',
  done: false, notify: true, notificationStatus: 'pending', isService: false,
  createdAt: '2026-05-04T10:00:00.000Z', updatedAt: '2026-05-04T10:00:00.000Z',
  ...over,
});

describe('TaskList', () => {
  it('non renderizza i task service nel modo "automatic"', () => {
    const tasks = [t({ id: '1', isService: false }), t({ id: '2', isService: true, title: 'Merenda' })];
    render(<TaskList tasks={tasks} mode="automatic" onToggleDone={() => {}} onEdit={() => {}} />);
    expect(screen.getByText('Prepara camera')).toBeTruthy();
    expect(screen.queryByText('Merenda')).toBeNull();
  });
  it('renderizza solo service nel modo "services"', () => {
    const tasks = [t({ id: '1', isService: false }), t({ id: '2', isService: true, title: 'Merenda' })];
    render(<TaskList tasks={tasks} mode="services" onToggleDone={() => {}} onEdit={() => {}} />);
    expect(screen.queryByText('Prepara camera')).toBeNull();
    expect(screen.getByText('Merenda')).toBeTruthy();
  });
  it('toggle done chiama onToggleDone con id', () => {
    let called = '';
    render(<TaskList tasks={[t({})]} mode="automatic" onToggleDone={(id) => { called = id; }} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(called).toBe('a');
  });
});
