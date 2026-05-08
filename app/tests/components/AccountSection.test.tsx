import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const signOutMock = vi.fn(() => Promise.resolve());
vi.mock('../../src/lib/firebase/auth', () => ({
  signOut: () => signOutMock(),
}));

import { AccountSection } from '../../src/components/settings/AccountSection';
import { useAuth } from '../../src/store/auth';

beforeEach(() => {
  signOutMock.mockClear();
  useAuth.setState({
    user: { email: 'test@example.com', name: 'Test User' },
    googleAccessToken: null,
  });
});

describe('AccountSection', () => {
  it('mostra l\'email dell\'utente corrente', () => {
    render(<AccountSection />);
    expect(screen.getByText('test@example.com')).toBeTruthy();
  });

  it('chiama signOut dopo conferma', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AccountSection />);
    fireEvent.click(screen.getByText('Esci'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(signOutMock).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  it('non chiama signOut se l\'utente annulla la conferma', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AccountSection />);
    fireEvent.click(screen.getByText('Esci'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('non renderizza nulla se non c\'è utente', () => {
    useAuth.setState({ user: null, googleAccessToken: null });
    const { container } = render(<AccountSection />);
    expect(container.firstChild).toBeNull();
  });
});
