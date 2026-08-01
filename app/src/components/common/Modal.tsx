import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export const Modal = ({ open, onClose, title, children, footer }: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // blocca lo scroll dello sfondo mentre il popup è aperto (anche annidato: ogni istanza
  // ripristina il valore che ha trovato al mount, non una stringa fissa)
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal open">
      <div className="modal-box">
        <div className="modal-head flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <h3 className="font-semibold text-lg">{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && (
          <div className="modal-foot border-t p-4" style={{ borderColor: 'var(--line)' }}>{footer}</div>
        )}
      </div>
    </div>
  );
};
