import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChanged = vi.fn();
const mockGetAuth = vi.fn(() => ({}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    addScope = vi.fn();
    static credentialFromResult = vi.fn(() => ({ accessToken: 'token-xyz' }));
  },
  getAuth: mockGetAuth,
  signInWithPopup: mockSignInWithPopup,
  signOut: mockSignOut,
  onAuthStateChanged: mockOnAuthStateChanged,
  indexedDBLocalPersistence: 'indexedDBLocalPersistence',
  setPersistence: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/lib/firebase/config', () => ({ app: {} }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('firebase auth', () => {
  it('signIn calls signInWithPopup and stores google access token', async () => {
    mockSignInWithPopup.mockResolvedValueOnce({
      user: { uid: 'u1', email: 'a@b.com', displayName: 'A', photoURL: null },
    });
    const { signIn } = await import('../../../src/lib/firebase/auth');
    const { useAuth } = await import('../../../src/store/auth');
    await signIn();
    expect(mockSignInWithPopup).toHaveBeenCalled();
    expect(useAuth.getState().googleAccessToken).toBe('token-xyz');
  });

  it('signOut clears auth state', async () => {
    mockSignOut.mockResolvedValueOnce(undefined);
    const { signOut } = await import('../../../src/lib/firebase/auth');
    const { useAuth } = await import('../../../src/store/auth');
    useAuth.setState({
      user: { email: 'a', name: 'A' },
      googleAccessToken: 't',
    });
    await signOut();
    expect(useAuth.getState().user).toBeNull();
    expect(useAuth.getState().googleAccessToken).toBeNull();
  });

  it('initAuthListener wires onAuthStateChanged to store', async () => {
    let cb: ((user: unknown) => void) | null = null;
    mockOnAuthStateChanged.mockImplementation((_a, fn) => { cb = fn; return () => {}; });
    const { initAuthListener } = await import('../../../src/lib/firebase/auth');
    const { useAuth } = await import('../../../src/store/auth');
    initAuthListener();
    cb?.({ uid: 'u1', email: 'x@y.com', displayName: 'X', photoURL: 'p' });
    expect(useAuth.getState().user).toEqual({ email: 'x@y.com', name: 'X', picture: 'p' });
    cb?.(null);
    expect(useAuth.getState().user).toBeNull();
  });
});
