import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/lib/firebase/auth', () => ({ auth: { currentUser: null } }));
vi.mock('../../src/lib/firebase/db', () => ({
  upsertDoc: vi.fn().mockResolvedValue(undefined),
  removeDoc: vi.fn().mockResolvedValue(undefined),
}));

import { useTemplates } from '../../src/store/templates';
import { DEFAULT_TEMPLATES } from '../../src/lib/reminders/templates';

describe('templates store', () => {
  beforeEach(() => {
    useTemplates.setState({ items: [] });
  });
  it('seedDefaults popola i 9 template default solo se vuoto', () => {
    useTemplates.getState().seedDefaults();
    expect(useTemplates.getState().items).toHaveLength(DEFAULT_TEMPLATES.length);
    useTemplates.getState().seedDefaults();
    expect(useTemplates.getState().items).toHaveLength(DEFAULT_TEMPLATES.length);
  });
  it('upsert aggiunge nuovo o aggiorna esistente', () => {
    useTemplates.getState().seedDefaults();
    const merenda = useTemplates.getState().items.find(t => t.id === 'merenda')!;
    useTemplates.getState().upsert({ ...merenda, defaultTime: '17:00' });
    expect(useTemplates.getState().items.find(t => t.id === 'merenda')!.defaultTime).toBe('17:00');
  });
  it('remove elimina un template', () => {
    useTemplates.getState().seedDefaults();
    const initial = useTemplates.getState().items.length;
    useTemplates.getState().remove('merenda');
    expect(useTemplates.getState().items).toHaveLength(initial - 1);
  });
  it('toggleEnabled inverte enabled', () => {
    useTemplates.getState().seedDefaults();
    useTemplates.getState().toggleEnabled('cena');
    expect(useTemplates.getState().items.find(t => t.id === 'cena')!.enabled).toBe(false);
  });
});
