import { useAuth } from '../../store/auth';
import { toE164 } from '../phone';

const BASE = 'https://people.googleapis.com/v1';
const READ_MASK = 'names,phoneNumbers,emailAddresses';

export interface GoogleContact {
  resourceName: string;
  displayName: string;
  phoneE164: string;
  email?: string;
}

export class ScopeError extends Error {
  constructor(msg = 'Missing People API scope') { super(msg); this.name = 'ScopeError'; }
}

const call = async <T = unknown>(url: string, init: RequestInit = {}): Promise<T> => {
  const t = useAuth.getState().googleAccessToken;
  if (!t) throw new Error('No access token');
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (res.status === 403) throw new ScopeError();
  if (!res.ok) throw new Error(`People API ${res.status}: ${await res.text()}`);
  return res.json();
};

interface PersonResp {
  resourceName: string;
  names?: Array<{ displayName?: string; givenName?: string }>;
  phoneNumbers?: Array<{ value?: string; canonicalForm?: string; metadata?: { primary?: boolean } }>;
  emailAddresses?: Array<{ value?: string; metadata?: { primary?: boolean } }>;
}

const toContact = (p: PersonResp, targetE164: string): GoogleContact | null => {
  const phones = p.phoneNumbers || [];
  const sorted = [...phones].sort((a, b) => {
    const ap = a.metadata?.primary ? 0 : 1;
    const bp = b.metadata?.primary ? 0 : 1;
    return ap - bp;
  });
  const match = sorted.find(ph => {
    const norm = ph.canonicalForm || toE164(ph.value || '');
    return norm === targetE164;
  });
  if (!match) return null;
  const email = (p.emailAddresses || []).find(e => e.metadata?.primary)?.value
    || p.emailAddresses?.[0]?.value;
  return {
    resourceName: p.resourceName,
    displayName: p.names?.[0]?.displayName || p.names?.[0]?.givenName || '',
    phoneE164: targetE164,
    email: email || undefined,
  };
};

export const searchByPhone = async (e164: string): Promise<GoogleContact | null> => {
  const url = `${BASE}/people:searchContacts?query=${encodeURIComponent(e164)}&readMask=${encodeURIComponent(READ_MASK)}`;
  const r = await call<{ results?: Array<{ person: PersonResp }> }>(url);
  for (const entry of r.results || []) {
    const c = toContact(entry.person, e164);
    if (c) return c;
  }
  return null;
};

export const createContact = async (input: { name: string; phoneE164: string }): Promise<GoogleContact> => {
  const url = `${BASE}/people:createContact?personFields=${encodeURIComponent(READ_MASK)}`;
  const body = {
    names: [{ givenName: input.name }],
    phoneNumbers: [{ value: input.phoneE164 }],
  };
  const p = await call<PersonResp>(url, { method: 'POST', body: JSON.stringify(body) });
  return {
    resourceName: p.resourceName,
    displayName: p.names?.[0]?.displayName || input.name,
    phoneE164: input.phoneE164,
    email: p.emailAddresses?.[0]?.value || undefined,
  };
};

export const getContact = async (resourceName: string): Promise<GoogleContact | null> => {
  const url = `${BASE}/${resourceName}?personFields=${encodeURIComponent(READ_MASK)}`;
  const p = await call<PersonResp>(url);
  const firstPhone = p.phoneNumbers?.[0];
  const e164 = firstPhone?.canonicalForm || toE164(firstPhone?.value || '') || '';
  return {
    resourceName: p.resourceName,
    displayName: p.names?.[0]?.displayName || '',
    phoneE164: e164,
    email: p.emailAddresses?.[0]?.value || undefined,
  };
};

export const warmupPeopleSearch = async (): Promise<void> => {
  try { await searchByPhone('+0'); } catch { /* intenzionalmente ignorato */ }
};
