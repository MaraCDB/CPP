import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationOnboarding } from '../../src/components/NotificationOnboarding';
import { useBookings } from '../../src/store/bookings';
import { useNotificationsStore } from '../../src/store/notifications';
import type { Prenotazione } from '../../src/types';

// Mock permission module so isStandalone and requestNotificationPermission are controllable
vi.mock('../../src/lib/notifications/permission', () => ({
  isStandalone: vi.fn(() => true),
  requestNotificationPermission: vi.fn(() => Promise.resolve('granted')),
}));

import { isStandalone, requestNotificationPermission } from '../../src/lib/notifications/permission';

const makeBooking = (id: string): Prenotazione => ({
  id,
  nomeCliente: 'Test',
  checkin: '2026-06-01',
  checkout: '2026-06-05',
  numOspiti: 2,
  stato: 'confermata',
  fonte: 'direct',
  prezzoTotale: 100,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isStandalone).mockReturnValue(true);
  // Reset stores to initial state
  useBookings.setState({ items: [] });
  useNotificationsStore.setState({ permission: 'default', bannerDismissed: false });
});

describe('NotificationOnboarding', () => {
  it('returns null when no bookings', () => {
    useBookings.setState({ items: [] });
    const { container } = render(<NotificationOnboarding />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when permission is not default (granted)', () => {
    useBookings.setState({ items: [makeBooking('b1')] });
    useNotificationsStore.setState({ permission: 'granted', bannerDismissed: false });
    const { container } = render(<NotificationOnboarding />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when permission is not default (denied)', () => {
    useBookings.setState({ items: [makeBooking('b1')] });
    useNotificationsStore.setState({ permission: 'denied', bannerDismissed: false });
    const { container } = render(<NotificationOnboarding />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when banner already dismissed', () => {
    useBookings.setState({ items: [makeBooking('b1')] });
    useNotificationsStore.setState({ permission: 'default', bannerDismissed: true });
    const { container } = render(<NotificationOnboarding />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when not in standalone mode', () => {
    vi.mocked(isStandalone).mockReturnValue(false);
    useBookings.setState({ items: [makeBooking('b1')] });
    useNotificationsStore.setState({ permission: 'default', bannerDismissed: false });
    const { container } = render(<NotificationOnboarding />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the banner when all conditions are met', () => {
    useBookings.setState({ items: [makeBooking('b1')] });
    useNotificationsStore.setState({ permission: 'default', bannerDismissed: false });
    render(<NotificationOnboarding />);
    expect(screen.getByText(/Vuoi attivare i promemoria/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Più tardi/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Attiva/i })).toBeTruthy();
  });

  it('clicking "Più tardi" dismisses the banner', () => {
    useBookings.setState({ items: [makeBooking('b1')] });
    useNotificationsStore.setState({ permission: 'default', bannerDismissed: false });
    render(<NotificationOnboarding />);
    fireEvent.click(screen.getByRole('button', { name: /Più tardi/i }));
    expect(useNotificationsStore.getState().bannerDismissed).toBe(true);
  });

  it('clicking "Attiva" calls requestNotificationPermission', () => {
    useBookings.setState({ items: [makeBooking('b1')] });
    useNotificationsStore.setState({ permission: 'default', bannerDismissed: false });
    render(<NotificationOnboarding />);
    fireEvent.click(screen.getByRole('button', { name: /Attiva/i }));
    expect(requestNotificationPermission).toHaveBeenCalledTimes(1);
  });
});
