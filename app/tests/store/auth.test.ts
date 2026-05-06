import { describe, it, expect, beforeEach } from 'vitest';
import { useAuth } from '../../src/store/auth';

const STORAGE_KEY = 'cpp-auth';
const FAKE_USER = { email: 'a@b.it', name: 'Mara', picture: 'p.png' };

describe('auth store', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuth.setState({ user: null, accessToken: null, tokenExpiry: 0, readonly: false });
  });

  it('setSession popola user, token ed expiry', () => {
    useAuth.getState().setSession(FAKE_USER, 'tok-123', 3600);
    const s = useAuth.getState();
    expect(s.user).toEqual(FAKE_USER);
    expect(s.accessToken).toBe('tok-123');
    expect(s.tokenExpiry).toBeGreaterThan(Date.now());
  });

  it('signOut resetta user e token', () => {
    useAuth.getState().setSession(FAKE_USER, 'tok-123', 3600);
    useAuth.getState().signOut();
    const s = useAuth.getState();
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.tokenExpiry).toBe(0);
  });

  it('persiste user in localStorage ma NON accessToken né tokenExpiry', () => {
    useAuth.getState().setSession(FAKE_USER, 'tok-secret', 3600);

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { state: Record<string, unknown> };
    expect(parsed.state.user).toEqual(FAKE_USER);
    expect(parsed.state).not.toHaveProperty('accessToken');
    expect(parsed.state).not.toHaveProperty('tokenExpiry');
  });

  it('signOut ripulisce lo user persistito', () => {
    useAuth.getState().setSession(FAKE_USER, 'tok-123', 3600);
    useAuth.getState().signOut();

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { state: { user: unknown } };
    expect(parsed.state.user).toBeNull();
  });
});
