import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockListCalendars, mockSignIn, mockEnqueue, mockRunQueueNow } = vi.hoisted(() => ({
  mockListCalendars: vi.fn(),
  mockSignIn: vi.fn().mockResolvedValue(undefined),
  mockEnqueue: vi.fn(),
  mockRunQueueNow: vi.fn(),
}));
vi.mock('../../src/lib/google/calendarSync', () => ({
  listCalendars: mockListCalendars,
  CalendarScopeError: class CalendarScopeError extends Error {},
}));
vi.mock('../../src/lib/firebase/auth', () => ({
  signIn: mockSignIn,
  auth: { currentUser: null },
}));
vi.mock('../../src/lib/google/calendarQueue', () => ({
  enqueue: mockEnqueue,
}));
vi.mock('../../src/hooks/useCalendarSyncQueue', () => ({
  runCalendarSyncQueueNow: mockRunQueueNow,
}));
vi.mock('../../src/store/bookings', () => ({
  useBookings: { getState: () => ({ items: [{ id: 'b1' }, { id: 'b2' }] }) },
}));
vi.mock('../../src/store/closures', () => ({
  useClosures: { getState: () => ({ items: [{ id: 'c1' }] }) },
}));

import { useCalendarSettings } from '../../src/store/calendarSettings';
import { CalendarSyncSection } from '../../src/components/settings/CalendarSyncSection';

describe('CalendarSyncSection', () => {
  beforeEach(() => {
    useCalendarSettings.setState({ googleCalendarId: null, googleCalendarName: null, calendarSyncEnabled: false });
    mockListCalendars.mockReset();
    mockSignIn.mockClear();
    mockEnqueue.mockClear();
    mockRunQueueNow.mockClear();
  });

  it('mostra "Non connesso" quando nessun calendario è collegato', () => {
    render(<CalendarSyncSection onBack={() => {}} />);
    expect(screen.getByText(/Non connesso/i)).toBeInTheDocument();
  });

  it('bottone "← Indietro" chiama onBack', () => {
    const onBack = vi.fn();
    render(<CalendarSyncSection onBack={onBack} />);
    fireEvent.click(screen.getByText('← Indietro'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('bottone "Connetti calendario" carica la lista e permette di scegliere', async () => {
    mockListCalendars.mockResolvedValueOnce([{ id: 'cal1', summary: 'Casa' }]);
    render(<CalendarSyncSection onBack={() => {}} />);
    fireEvent.click(screen.getByText(/Connetti calendario/i));
    await waitFor(() => expect(screen.getByText('Casa')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Casa'));
    expect(useCalendarSettings.getState().googleCalendarId).toBe('cal1');
    expect(useCalendarSettings.getState().calendarSyncEnabled).toBe(true);
  });

  it('selezionare un calendario accoda tutte le prenotazioni/chiusure esistenti e svuota subito la coda', async () => {
    mockListCalendars.mockResolvedValueOnce([{ id: 'cal1', summary: 'Casa' }]);
    render(<CalendarSyncSection onBack={() => {}} />);
    fireEvent.click(screen.getByText(/Connetti calendario/i));
    await waitFor(() => expect(screen.getByText('Casa')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Casa'));

    expect(mockEnqueue).toHaveBeenCalledWith('booking', 'b1', 'upsert');
    expect(mockEnqueue).toHaveBeenCalledWith('booking', 'b2', 'upsert');
    expect(mockEnqueue).toHaveBeenCalledWith('closure', 'c1', 'upsert');
    expect(mockRunQueueNow).toHaveBeenCalledTimes(1);
  });

  it('mostra "Connesso a «Casa»" e il toggle quando collegato', () => {
    useCalendarSettings.setState({ googleCalendarId: 'cal1', googleCalendarName: 'Casa', calendarSyncEnabled: true });
    render(<CalendarSyncSection onBack={() => {}} />);
    expect(screen.getByText(/Casa/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('il toggle disabilita il sync senza scollegare', () => {
    useCalendarSettings.setState({ googleCalendarId: 'cal1', googleCalendarName: 'Casa', calendarSyncEnabled: true });
    render(<CalendarSyncSection onBack={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(useCalendarSettings.getState().calendarSyncEnabled).toBe(false);
    expect(useCalendarSettings.getState().googleCalendarId).toBe('cal1');
  });

  it('"Disconnetti" azzera il calendario collegato', () => {
    useCalendarSettings.setState({ googleCalendarId: 'cal1', googleCalendarName: 'Casa', calendarSyncEnabled: true });
    render(<CalendarSyncSection onBack={() => {}} />);
    fireEvent.click(screen.getByText(/Disconnetti/i));
    expect(useCalendarSettings.getState().googleCalendarId).toBeNull();
  });

  it('offre "Riconnetti Google" anche da non connesso, se la lista calendari fallisce per sessione scaduta', async () => {
    const { CalendarScopeError } = await import('../../src/lib/google/calendarSync');
    mockListCalendars.mockRejectedValueOnce(new CalendarScopeError());
    render(<CalendarSyncSection onBack={() => {}} />);

    fireEvent.click(screen.getByText(/Connetti calendario/i));

    await waitFor(() => expect(screen.getByText(/sessione scaduta/i)).toBeInTheDocument());
    expect(screen.getByText(/Riconnetti Google/i)).toBeInTheDocument();
  });

  it('dopo il riconnetti da non connesso ritenta la lista calendari', async () => {
    const { CalendarScopeError } = await import('../../src/lib/google/calendarSync');
    mockListCalendars.mockRejectedValueOnce(new CalendarScopeError());
    render(<CalendarSyncSection onBack={() => {}} />);
    fireEvent.click(screen.getByText(/Connetti calendario/i));
    await waitFor(() => expect(screen.getByText(/Riconnetti Google/i)).toBeInTheDocument());

    mockListCalendars.mockResolvedValueOnce([{ id: 'cal1', summary: 'Casa' }]);
    fireEvent.click(screen.getByText(/Riconnetti Google/i));

    await waitFor(() => expect(screen.getByText('Casa')).toBeInTheDocument());
    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });

  it('"Riconnetti Google" è visibile quando connesso e rifà il login e svuota la coda', async () => {
    useCalendarSettings.setState({ googleCalendarId: 'cal1', googleCalendarName: 'Casa', calendarSyncEnabled: true });
    render(<CalendarSyncSection onBack={() => {}} />);
    fireEvent.click(screen.getByText(/Riconnetti Google/i));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    expect(mockRunQueueNow).toHaveBeenCalledTimes(1);
  });
});
