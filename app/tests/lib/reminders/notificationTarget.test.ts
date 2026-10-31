import { describe, it, expect } from 'vitest';
import { buildNotificationUrl, findWindowInScope } from '../../../src/lib/reminders/notificationTarget';

const PAGES_SCOPE = 'https://maracdb.github.io/CPP/';
const ROOT_SCOPE = 'https://cpp.cuoredibosco.it/';

describe('buildNotificationUrl', () => {
  it('appends booking and task ids to the Pages scope', () => {
    expect(buildNotificationUrl(PAGES_SCOPE, { bookingId: 'b1', taskId: 't1' }))
      .toBe('https://maracdb.github.io/CPP/?booking=b1&task=t1');
  });

  it('appends booking and task ids to the root scope', () => {
    expect(buildNotificationUrl(ROOT_SCOPE, { bookingId: 'b1', taskId: 't1' }))
      .toBe('https://cpp.cuoredibosco.it/?booking=b1&task=t1');
  });

  it('uses empty values when ids are missing', () => {
    expect(buildNotificationUrl(ROOT_SCOPE, { bookingId: 'b1' })).toBe('https://cpp.cuoredibosco.it/?booking=b1&task=');
    expect(buildNotificationUrl(ROOT_SCOPE, {})).toBe('https://cpp.cuoredibosco.it/?booking=&task=');
    expect(buildNotificationUrl(ROOT_SCOPE, undefined)).toBe('https://cpp.cuoredibosco.it/?booking=&task=');
  });
});

describe('findWindowInScope', () => {
  it('matches a window inside the Pages scope', () => {
    const inScope = { url: 'https://maracdb.github.io/CPP/?booking=b1' };
    expect(findWindowInScope([{ url: 'https://example.com/' }, inScope], PAGES_SCOPE)).toBe(inScope);
  });

  it('matches a window inside the root scope', () => {
    const inScope = { url: 'https://cpp.cuoredibosco.it/' };
    expect(findWindowInScope([inScope], ROOT_SCOPE)).toBe(inScope);
  });

  it('does not match a window on another origin', () => {
    expect(findWindowInScope([{ url: 'https://other.example.com/' }], ROOT_SCOPE)).toBeUndefined();
  });

  it('does not match a window on another path of the same origin', () => {
    expect(findWindowInScope([{ url: 'https://maracdb.github.io/Other/' }], PAGES_SCOPE)).toBeUndefined();
  });

  it('returns undefined when there are no windows', () => {
    expect(findWindowInScope([], ROOT_SCOPE)).toBeUndefined();
  });
});
