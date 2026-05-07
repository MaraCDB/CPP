import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

vi.mock('../../../src/store/auth', () => ({
  useAuth: { getState: () => ({ googleAccessToken: 'tok' }) },
}));

describe('driveBackup', () => {
  it('uploadToDrive issues multipart POST to upload endpoint', async () => {
    fetchMock.mockResolvedValueOnce(new Response(
      JSON.stringify({ id: 'driveFileId123', name: 'backup.zip' }),
      { status: 200 },
    ));
    const { uploadToDrive } = await import('../../../src/lib/google/driveBackup');
    const id = await uploadToDrive('backup-2026-05-06.zip', new Uint8Array([1,2,3]));
    expect(id).toBe('driveFileId123');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('upload/drive/v3/files'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('listDriveBackups queries Drive with appProperties filter', async () => {
    fetchMock.mockResolvedValueOnce(new Response(
      JSON.stringify({ files: [{ id: 'a', name: 'backup-2026-05-06.zip', size: '1234', createdTime: '2026-05-06T00:00:00Z' }] }),
      { status: 200 },
    ));
    const { listDriveBackups } = await import('../../../src/lib/google/driveBackup');
    const list = await listDriveBackups();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('backup-2026-05-06.zip');
  });

  it('throws DriveScopeError on 403', async () => {
    fetchMock.mockResolvedValueOnce(new Response('forbidden', { status: 403 }));
    const { uploadToDrive, DriveScopeError } = await import('../../../src/lib/google/driveBackup');
    await expect(uploadToDrive('x.zip', new Uint8Array())).rejects.toThrow(DriveScopeError);
  });
});
