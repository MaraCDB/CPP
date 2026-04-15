import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export const Modal = ({ open, onClose, title, children }: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <h3 className="font-semibold text-lg">{title}</h3>
          <button className="btn btn-ghost !p-2" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};
