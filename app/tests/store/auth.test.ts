import { describe, it, expect, beforeEach } from 'vitest';
import { useAuth } from '../../src/store/auth';

beforeEach(() => {
  useAuth.setState({ user: null, googleAccessToken: null });
});

describe('useAuth', () => {
  it('starts empty', () => {
    expect(useAuth.getState().user).toBeNull();
    expect(useAuth.getState().googleAccessToken).toBeNull();
  });

  it('stores user and googleAccessToken via setState', () => {
    useAuth.setState({
      user: { email: 'a@b.com', name: 'A' },
      googleAccessToken: 'tok',
    });
    expect(useAuth.getState().user?.email).toBe('a@b.com');
    expect(useAuth.getState().googleAccessToken).toBe('tok');
  });
});
