import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockBuildZipBytes, mockUploadToDrive, mockListDriveBackups, mockMarkBackupNow, mockLastBackupAt } = vi.hoisted(() => ({
  mockBuildZipBytes: vi.fn(),
  mockUploadToDrive: vi.fn(),
  mockListDriveBackups: vi.fn(),
  mockMarkBackupNow: vi.fn(),
  mockLastBackupAt: vi.fn(),
}));
vi.mock('../../src/lib/firebase/backup', () => ({
  buildZipBytes: mockBuildZipBytes,
}));
vi.mock('../../src/lib/google/driveBackup', () => ({
  uploadToDrive: mockUploadToDrive,
  listDriveBackups: mockListDriveBackups,
  markBackupNow: mockMarkBackupNow,
  lastBackupAt: mockLastBackupAt,
  DriveScopeError: class DriveScopeError extends Error {},
}));

import { BackupSection } from '../../src/components/settings/BackupSection';

describe('BackupSection', () => {
  beforeEach(() => {
    mockBuildZipBytes.mockReset();
    mockUploadToDrive.mockReset();
    mockListDriveBackups.mockReset().mockResolvedValue([]);
    mockMarkBackupNow.mockReset();
    mockLastBackupAt.mockReset().mockReturnValue(0);
  });

  it('bottone "← Indietro" chiama onBack', async () => {
    const onBack = vi.fn();
    render(<BackupSection onBack={onBack} />);
    await waitFor(() => expect(mockListDriveBackups).toHaveBeenCalled());
    fireEvent.click(screen.getByText('← Indietro'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('mostra "Nessun backup ancora creato" quando lastBackupAt è 0', async () => {
    render(<BackupSection onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Nessun backup ancora creato/i)).toBeInTheDocument());
  });

  it('elenca i backup esistenti restituiti da listDriveBackups', async () => {
    mockListDriveBackups.mockResolvedValueOnce([
      { id: 'f1', name: 'cdb-backup-2026-08-01.zip', size: 2048, createdAt: '2026-08-01T00:00:00.000Z' },
    ]);
    render(<BackupSection onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('cdb-backup-2026-08-01.zip')).toBeInTheDocument());
  });

  it('"Esporta backup ora" crea lo zip, lo carica su Drive e aggiorna la lista', async () => {
    mockBuildZipBytes.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
    mockUploadToDrive.mockResolvedValueOnce('drive-file-id');
    mockListDriveBackups
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'drive-file-id', name: 'x.zip', size: 100, createdAt: '2026-08-01T00:00:00.000Z' }]);
    render(<BackupSection onBack={() => {}} />);
    await waitFor(() => expect(mockListDriveBackups).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('Esporta backup ora'));
    await waitFor(() => expect(mockUploadToDrive).toHaveBeenCalledTimes(1));
    expect(mockMarkBackupNow).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText('x.zip')).toBeInTheDocument());
  });

  it('mostra un errore se listDriveBackups lancia DriveScopeError', async () => {
    const { DriveScopeError } = await import('../../src/lib/google/driveBackup');
    mockListDriveBackups.mockRejectedValueOnce(new DriveScopeError());
    render(<BackupSection onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Riconnetti l’account Google/i)).toBeInTheDocument());
  });
});
