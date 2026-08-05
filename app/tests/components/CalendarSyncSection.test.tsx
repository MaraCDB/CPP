import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockListCalendars } = vi.hoisted(() => ({
  mockListCalendars: vi.fn(),
}));
vi.mock('../../src/lib/google/calendarSync', () => ({
  listCalendars: mockListCalendars,
  CalendarScopeError: class CalendarScopeError extends Error {},
}));

import { useCalendarSettings } from '../../src/store/calendarSettings';
import { CalendarSyncSection } from '../../src/components/settings/CalendarSyncSection';

describe('CalendarSyncSection', () => {
  beforeEach(() => {
    useCalendarSettings.setState({ googleCalendarId: null, googleCalendarName: null, calendarSyncEnabled: false });
    mockListCalendars.mockReset();
  });

  it('mostra "Non connesso" quando nessun calendario è collegato', () => {
    render(<CalendarSyncSection />);
    expect(screen.getByText(/Non connesso/i)).toBeInTheDocument();
  });

  it('bottone "Connetti calendario" carica la lista e permette di scegliere', async () => {
    mockListCalendars.mockResolvedValueOnce([{ id: 'cal1', summary: 'Casa' }]);
    render(<CalendarSyncSection />);
    fireEvent.click(screen.getByText(/Connetti calendario/i));
    await waitFor(() => expect(screen.getByText('Casa')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Casa'));
    expect(useCalendarSettings.getState().googleCalendarId).toBe('cal1');
    expect(useCalendarSettings.getState().calendarSyncEnabled).toBe(true);
  });

  it('mostra "Connesso a «Casa»" e il toggle quando collegato', () => {
    useCalendarSettings.setState({ googleCalendarId: 'cal1', googleCalendarName: 'Casa', calendarSyncEnabled: true });
    render(<CalendarSyncSection />);
    expect(screen.getByText(/Casa/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('il toggle disabilita il sync senza scollegare', () => {
    useCalendarSettings.setState({ googleCalendarId: 'cal1', googleCalendarName: 'Casa', calendarSyncEnabled: true });
    render(<CalendarSyncSection />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(useCalendarSettings.getState().calendarSyncEnabled).toBe(false);
    expect(useCalendarSettings.getState().googleCalendarId).toBe('cal1');
  });

  it('"Disconnetti" azzera il calendario collegato', () => {
    useCalendarSettings.setState({ googleCalendarId: 'cal1', googleCalendarName: 'Casa', calendarSyncEnabled: true });
    render(<CalendarSyncSection />);
    fireEvent.click(screen.getByText(/Disconnetti/i));
    expect(useCalendarSettings.getState().googleCalendarId).toBeNull();
  });
});
