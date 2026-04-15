import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export const SidePanel = ({ open, title, onClose, children }: Props) => (
  <aside className={'side' + (open ? ' open' : '')}>
    <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--line)' }}>
      <h2 className="font-semibold">{title}</h2>
      <button className="btn btn-ghost !p-2" onClick={onClose}>✕</button>
    </div>
    <div className="p-4">{children}</div>
  </aside>
);
