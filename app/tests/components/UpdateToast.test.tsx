import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateToast } from '../../src/components/UpdateToast';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface MockRegisterSWReturn {
  needRefresh: [boolean, (v: boolean) => void];
  offlineReady: [boolean, (v: boolean) => void];
  updateServiceWorker: (v: boolean) => Promise<void>;
}

describe('UpdateToast', () => {
  const mockUpdateServiceWorker = vi.fn();
  const mockSetNeedRefresh = vi.fn();
  const mockSetOfflineReady = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when both needRefresh and offlineReady are false', () => {
    (useRegisterSW as MockedFunction<typeof useRegisterSW>).mockReturnValue({
      needRefresh: [false, mockSetNeedRefresh],
      offlineReady: [false, mockSetOfflineReady],
      updateServiceWorker: mockUpdateServiceWorker,
    } as unknown as MockRegisterSWReturn);

    const { container } = render(<UpdateToast />);
    expect(container.firstChild).toBeNull();
  });

  it('renders update message when needRefresh is true and clicking Ricarica calls updateServiceWorker(true)', () => {
    (useRegisterSW as MockedFunction<typeof useRegisterSW>).mockReturnValue({
      needRefresh: [true, mockSetNeedRefresh],
      offlineReady: [false, mockSetOfflineReady],
      updateServiceWorker: mockUpdateServiceWorker,
    } as unknown as MockRegisterSWReturn);

    render(<UpdateToast />);

    expect(screen.getByText(/🔄 Aggiornamento disponibile/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ricarica/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ricarica/i }));
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('renders offline message when offlineReady is true', () => {
    (useRegisterSW as MockedFunction<typeof useRegisterSW>).mockReturnValue({
      needRefresh: [false, mockSetNeedRefresh],
      offlineReady: [true, mockSetOfflineReady],
      updateServiceWorker: mockUpdateServiceWorker,
    } as unknown as MockRegisterSWReturn);

    render(<UpdateToast />);

    expect(screen.getByText(/📴 App pronta offline/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ricarica/i })).not.toBeInTheDocument();
  });

  it('clicking Chiudi calls both setters with false', () => {
    (useRegisterSW as MockedFunction<typeof useRegisterSW>).mockReturnValue({
      needRefresh: [true, mockSetNeedRefresh],
      offlineReady: [false, mockSetOfflineReady],
      updateServiceWorker: mockUpdateServiceWorker,
    } as unknown as MockRegisterSWReturn);

    render(<UpdateToast />);

    fireEvent.click(screen.getByRole('button', { name: /Chiudi/i }));
    expect(mockSetNeedRefresh).toHaveBeenCalledWith(false);
    expect(mockSetOfflineReady).toHaveBeenCalledWith(false);
  });
});
