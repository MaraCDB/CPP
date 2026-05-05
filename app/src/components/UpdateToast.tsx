import { useRegisterSW } from 'virtual:pwa-register/react';

export const UpdateToast = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(reg) { console.info('[pwa] SW registered', reg); },
    onRegisterError(err) { console.warn('[pwa] SW register error', err); },
  });

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      className="fixed bottom-3 left-3 right-3 px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg z-50"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
    >
      <div className="text-sm flex-1">
        {needRefresh ? '🔄 Aggiornamento disponibile' : '📴 App pronta offline'}
      </div>
      {needRefresh && (
        <button className="btn btn-primary" onClick={() => void updateServiceWorker(true)}>
          Ricarica
        </button>
      )}
      <button
        className="btn btn-ghost"
        onClick={() => { setNeedRefresh(false); setOfflineReady(false); }}
      >
        Chiudi
      </button>
    </div>
  );
};
