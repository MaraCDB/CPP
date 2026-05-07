import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const subs: string[] = [];
vi.mock('../../src/lib/firebase/db', () => ({
  subscribeCollection: vi.fn((_uid, name) => {
    subs.push(name);
    return () => { subs.splice(subs.indexOf(name), 1); };
  }),
}));

beforeEach(() => { subs.length = 0; });

describe('useFirestoreSync', () => {
  it('subscribes 5 collections when uid is provided', async () => {
    const { useFirestoreSync } = await import('../../src/hooks/useFirestoreSync');
    renderHook(() => useFirestoreSync('u1'));
    expect(subs).toEqual(['bookings','closures','promemoria','tasks','templates']);
  });

  it('does nothing when uid is null', async () => {
    const { useFirestoreSync } = await import('../../src/hooks/useFirestoreSync');
    renderHook(() => useFirestoreSync(null));
    expect(subs).toEqual([]);
  });

  it('unsubscribes on uid change', async () => {
    const { useFirestoreSync } = await import('../../src/hooks/useFirestoreSync');
    const { rerender } = renderHook(({ uid }: { uid: string | null }) => useFirestoreSync(uid), {
      initialProps: { uid: 'u1' },
    });
    expect(subs.length).toBe(5);
    rerender({ uid: null });
    expect(subs.length).toBe(0);
  });
});
