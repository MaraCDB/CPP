import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../src/store/bookings', () => ({
  useBookings: () => ({ items: [], add: vi.fn(), update: vi.fn(), remove: vi.fn() }),
}));
vi.mock('../../src/store/closures', () => ({
  useClosures: (selector: (s: { items: [] }) => unknown) => selector({ items: [] }),
}));

import { BookingForm } from '../../src/components/forms/BookingForm';

describe('BookingForm - check-in/check-out date range', () => {
  it('non impone un minimo sul check-out finché il check-in non è impostato', () => {
    render(<BookingForm onClose={() => {}} />);
    const checkout = screen.getByLabelText('Check-out') as HTMLInputElement;
    expect(checkout.min).toBe('');
  });

  it('impone come minimo il giorno successivo al check-in selezionato', () => {
    render(<BookingForm onClose={() => {}} />);
    const checkin = screen.getByLabelText('Check-in') as HTMLInputElement;
    fireEvent.change(checkin, { target: { value: '2026-07-10' } });
    const checkout = screen.getByLabelText('Check-out') as HTMLInputElement;
    expect(checkout.min).toBe('2026-07-11');
  });

  it('svuota il check-out se diventa antecedente o uguale al nuovo check-in', () => {
    render(<BookingForm onClose={() => {}} />);
    const checkin = screen.getByLabelText('Check-in') as HTMLInputElement;
    const checkout = screen.getByLabelText('Check-out') as HTMLInputElement;

    fireEvent.change(checkin, { target: { value: '2026-07-10' } });
    fireEvent.change(checkout, { target: { value: '2026-07-12' } });
    expect(checkout.value).toBe('2026-07-12');

    fireEvent.change(checkin, { target: { value: '2026-07-15' } });
    expect(checkout.value).toBe('');
  });
});
