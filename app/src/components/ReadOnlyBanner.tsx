import { useAuth } from '../store/auth';

export const ReadOnlyBanner = () => {
  const readonly = useAuth(s => s.readonly);
  if (!readonly) return null;
  return (
    <div
      className="px-4 py-2 text-[12px]"
      style={{ background: 'var(--banner-bg)', color: 'var(--banner-text)', borderBottom: '1px solid var(--banner-border)' }}
    >
      👁️ <b>Sola visualizzazione</b> — non hai i permessi di modifica su questo calendario.
    </div>
  );
};
