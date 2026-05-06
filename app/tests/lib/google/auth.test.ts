import { describe, it, expect } from 'vitest';
import { SCOPES } from '../../../src/lib/google/auth';

describe('Google OAuth scopes', () => {
  it('include lo scope drive completo per ricerca cross-device del file', () => {
    expect(SCOPES).toContain('https://www.googleapis.com/auth/drive ');
  });

  it('non usa più drive.file (che limita la visibilità a file creati/aperti dall’istanza app)', () => {
    expect(SCOPES).not.toContain('drive.file');
  });

  it('mantiene gli scope necessari a sheets e contatti', () => {
    expect(SCOPES).toContain('https://www.googleapis.com/auth/spreadsheets');
    expect(SCOPES).toContain('https://www.googleapis.com/auth/contacts');
  });

  it('include gli scope OIDC base per recuperare email/nome/picture', () => {
    expect(SCOPES).toContain('openid');
    expect(SCOPES).toContain('email');
    expect(SCOPES).toContain('profile');
  });
});
