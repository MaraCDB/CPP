import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/lib/firebase/auth', () => ({ auth: { currentUser: { uid: 'u1' } } }));
vi.mock('../../src/lib/firebase/db', () => ({
  updateUserSettings: vi.fn().mockResolvedValue(undefined),
}));

import { useCalendarSettings } from '../../src/store/calendarSettings';
import { updateUserSettings } from '../../src/lib/firebase/db';

const mockUpdateUserSettings = vi.mocked(updateUserSettings);

describe('calendarSettings store', () => {
  beforeEach(() => {
    useCalendarSettings.setState({ googleCalendarId: null, googleCalendarName: null, calendarSyncEnabled: false });
    mockUpdateUserSettings.mockClear();
  });

  it('inizia disconnesso', () => {
    const s = useCalendarSettings.getState();
    expect(s.googleCalendarId).toBeNull();
    expect(s.calendarSyncEnabled).toBe(false);
  });

  it('setCalendar salva id/nome e abilita il sync', () => {
    useCalendarSettings.getState().setCalendar('cal-123', 'Casa');
    const s = useCalendarSettings.getState();
    expect(s.googleCalendarId).toBe('cal-123');
    expect(s.googleCalendarName).toBe('Casa');
    expect(s.calendarSyncEnabled).toBe(true);
    expect(mockUpdateUserSettings).toHaveBeenCalledWith('u1', {
      googleCalendarId: 'cal-123', googleCalendarName: 'Casa', calendarSyncEnabled: true,
    });
  });

  it('setEnabled aggiorna solo il flag', () => {
    useCalendarSettings.getState().setCalendar('cal-123', 'Casa');
    useCalendarSettings.getState().setEnabled(false);
    expect(useCalendarSettings.getState().calendarSyncEnabled).toBe(false);
    expect(mockUpdateUserSettings).toHaveBeenCalledWith('u1', { calendarSyncEnabled: false });
  });

  it('disconnect azzera tutto', () => {
    useCalendarSettings.getState().setCalendar('cal-123', 'Casa');
    useCalendarSettings.getState().disconnect();
    const s = useCalendarSettings.getState();
    expect(s.googleCalendarId).toBeNull();
    expect(s.calendarSyncEnabled).toBe(false);
    expect(mockUpdateUserSettings).toHaveBeenCalledWith('u1', {
      googleCalendarId: null, googleCalendarName: null, calendarSyncEnabled: false,
    });
  });
});
