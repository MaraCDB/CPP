import { useBookings } from '../store/bookings';
import { useNotificationsStore } from '../store/notifications';
import { isStandalone, requestNotificationPermission } from '../lib/notifications/permission';

export const NotificationOnboarding = () => {
  const bookings = useBookings(s => s.items);
  const permission = useNotificationsStore(s => s.permission);
  const dismissed = useNotificationsStore(s => s.bannerDismissed);
  const dismiss = useNotificationsStore(s => s.dismissBanner);

  if (bookings.length === 0) return null;
  if (permission !== 'default') return null;
  if (dismissed) return null;
  if (!isStandalone()) return null;

  return (
    <div
      className="px-4 py-3 flex items-center gap-3"
      style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}
    >
      <div className="text-sm flex-1">🔔 Vuoi attivare i promemoria sul telefono?</div>
      <button className="btn btn-ghost" onClick={dismiss}>Più tardi</button>
      <button
        className="btn btn-primary"
        onClick={() => { void requestNotificationPermission(); }}
      >
        Attiva
      </button>
    </div>
  );
};
