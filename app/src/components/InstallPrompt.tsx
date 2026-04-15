import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt = () => {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      const visits = Number(localStorage.getItem('cdb_visits') || '0') + 1;
      localStorage.setItem('cdb_visits', String(visits));
      if (visits >= 2) setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  if (!visible || !prompt) return null;
  return (
    <div className="px-4 py-3 flex items-center gap-3" style={{ background:'var(--surface-2)', borderBottom:'1px solid var(--line)' }}>
      <div className="text-sm flex-1">📱 Installa l'app sul telefono per aprirla come una normale app</div>
      <button className="btn btn-ghost" onClick={() => setVisible(false)}>Più tardi</button>
      <button className="btn btn-primary" onClick={() => { void prompt.prompt(); setVisible(false); }}>Installa</button>
    </div>
  );
};
