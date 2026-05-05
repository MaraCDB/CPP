import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationsStore } from '../../src/store/notifications';

describe('useNotificationsStore', () => {
  beforeEach(() => {
    useNotificationsStore.setState({ permission: 'default', bannerDismissed: false });
  });

  it('starts with default permission and banner not dismissed', () => {
    const { permission, bannerDismissed } = useNotificationsStore.getState();
    expect(permission).toBe('default');
    expect(bannerDismissed).toBe(false);
  });

  it('setPermission updates permission', () => {
    useNotificationsStore.getState().setPermission('granted');
    expect(useNotificationsStore.getState().permission).toBe('granted');

    useNotificationsStore.getState().setPermission('denied');
    expect(useNotificationsStore.getState().permission).toBe('denied');
  });

  it('dismissBanner sets bannerDismissed to true', () => {
    useNotificationsStore.getState().dismissBanner();
    expect(useNotificationsStore.getState().bannerDismissed).toBe(true);
  });
});
