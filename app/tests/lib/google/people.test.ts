import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuth } from '../../../src/store/auth';
import { searchByPhone, createContact, ScopeError } from '../../../src/lib/google/people';

const mockFetch = (responses: Array<{ ok: boolean; status?: number; body: unknown }>) => {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[i++];
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
    } as Response;
  });
};

describe('people API', () => {
  beforeEach(() => {
    useAuth.setState({ accessToken: 'fake-token', tokenExpiry: Date.now() + 3600_000 } as Parameters<typeof useAuth.setState>[0]);
  });
  afterEach(() => vi.restoreAllMocks());

  describe('searchByPhone', () => {
    it('ritorna match esatto su numero E.164', async () => {
      vi.stubGlobal('fetch', mockFetch([{
        ok: true, body: {
          results: [{
            person: {
              resourceName: 'people/c1',
              names: [{ displayName: 'Mario Rossi' }],
              phoneNumbers: [{ value: '+39 335 1234567', canonicalForm: '+393351234567' }],
              emailAddresses: [{ value: 'mario@rossi.it' }],
            },
          }],
        },
      }]));
      const r = await searchByPhone('+393351234567');
      expect(r).toEqual({
        resourceName: 'people/c1',
        displayName: 'Mario Rossi',
        phoneE164: '+393351234567',
        email: 'mario@rossi.it',
      });
    });

    it('ritorna null se nessun match', async () => {
      vi.stubGlobal('fetch', mockFetch([{ ok: true, body: { results: [] } }]));
      const r = await searchByPhone('+393351234567');
      expect(r).toBeNull();
    });

    it('ritorna null se il match ha un numero diverso dopo normalizzazione', async () => {
      vi.stubGlobal('fetch', mockFetch([{
        ok: true, body: {
          results: [{
            person: {
              resourceName: 'people/c1',
              names: [{ displayName: 'Altro' }],
              phoneNumbers: [{ value: '+39 02 1234' }],
            },
          }],
        },
      }]));
      const r = await searchByPhone('+393351234567');
      expect(r).toBeNull();
    });

    it('preferisce telefono primary se presente', async () => {
      vi.stubGlobal('fetch', mockFetch([{
        ok: true, body: {
          results: [{
            person: {
              resourceName: 'people/c1',
              names: [{ displayName: 'Mario' }],
              phoneNumbers: [
                { value: '+39 02 0000000' },
                { value: '+393351234567', metadata: { primary: true } },
              ],
            },
          }],
        },
      }]));
      const r = await searchByPhone('+393351234567');
      expect(r?.phoneE164).toBe('+393351234567');
    });

    it('lancia ScopeError su 403', async () => {
      vi.stubGlobal('fetch', mockFetch([{ ok: false, status: 403, body: { error: 'insufficient scope' } }]));
      await expect(searchByPhone('+393351234567')).rejects.toThrow(ScopeError);
    });
  });

  describe('createContact', () => {
    it('POSTa il payload corretto e ritorna il contatto', async () => {
      const fetchSpy = mockFetch([{
        ok: true, body: {
          resourceName: 'people/c2',
          names: [{ displayName: 'Nuovo Ospite' }],
          phoneNumbers: [{ value: '+393351234567' }],
        },
      }]);
      vi.stubGlobal('fetch', fetchSpy);
      const r = await createContact({ name: 'Nuovo Ospite', phoneE164: '+393351234567' });
      expect(r.resourceName).toBe('people/c2');
      expect(r.phoneE164).toBe('+393351234567');
      const call = fetchSpy.mock.calls[0];
      expect(call[0]).toContain('people:createContact');
      const body = JSON.parse((call[1] as RequestInit).body as string);
      expect(body.names[0].givenName).toBe('Nuovo Ospite');
      expect(body.phoneNumbers[0].value).toBe('+393351234567');
    });
  });
});
