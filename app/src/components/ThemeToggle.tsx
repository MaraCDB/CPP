import { useEffect } from 'react';
import { useSettings } from '../store/settings';
import type { Tema } from '../types';

const resolve = (t: Tema): 'light'|'dark' =>
  t === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;

const icon = (t: Tema, resolved: 'light'|'dark') =>
  t === 'auto' ? '🌓' : resolved === 'dark' ? '🌙' : '☀️';

export const ThemeToggle = ({ floating = false }: { floating?: boolean }) => {
  const { tema, setTema } = useSettings();
  const resolved = resolve(tema);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
  }, [resolved]);

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (useSettings.getState().tema === 'auto') document.documentElement.setAttribute('data-theme', resolve('auto')); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const cycle = () => {
    const next: Tema = tema === 'light' ? 'dark' : tema === 'dark' ? 'auto' : 'light';
    setTema(next);
  };

  const cls = floating
    ? 'absolute top-[calc(env(safe-area-inset-top)+14px)] right-[14px] w-10 h-10 rounded-full text-lg cursor-pointer'
    : 'btn btn-ghost !p-2';

  return (
    <button onClick={cycle} title="Tema" className={cls}
      style={floating ? { background: 'var(--card)', border: '1px solid var(--line)' } : {}}>
      {icon(tema, resolved)}
    </button>
  );
};
