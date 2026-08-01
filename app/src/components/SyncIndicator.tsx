import { useFirestoreStatus } from '../hooks/useFirestoreStatus';
import { goOnline } from '../lib/firebase/db';

const LABEL = {
  idle: { icon: '🟢', text: 'Sincronizzato' },
  offline: { icon: '🔴', text: 'Offline' },
  unauth: { icon: '🔒', text: 'Non connesso' },
} as const;

export const SyncIndicator = () => {
  const status = useFirestoreStatus();
  const l = LABEL[status];
  return (
    <button
      className="btn btn-ghost btn-icon round text-xs"
      title={l.text}
      onClick={() => void goOnline()}
    >
      {l.icon}
    </button>
  );
};
