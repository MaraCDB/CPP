import { useSync } from '../store/sync';
import { fullPull } from '../lib/sync';

const LABEL = {
  idle: { icon: '🟢', text: 'Sincronizzato' },
  syncing: { icon: '🟡', text: 'Sincronizzazione…' },
  offline: { icon: '🔴', text: 'Offline' },
  error: { icon: '⚠️', text: 'Errore' },
  unauth: { icon: '🔒', text: 'Non connesso' },
} as const;

export const SyncIndicator = () => {
  const { status, queue } = useSync();
  const l = LABEL[status];
  return (
    <button
      className="btn btn-ghost !p-2 text-xs"
      title={`${l.text}${queue.length ? ` · ${queue.length} in coda` : ''}`}
      onClick={() => void fullPull()}
    >
      {l.icon}
      {queue.length > 0 && <span className="ml-1">{queue.length}</span>}
    </button>
  );
};
