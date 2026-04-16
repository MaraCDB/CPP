import { useState, useRef, useEffect } from 'react';

interface Props {
  phoneE164: string;
  label: string;
  email?: string;
  resourceName?: string;
  onMissingEmail?: () => void;
}

export const ContactMenu = ({ phoneE164, label, email, resourceName, onMissingEmail }: Props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const waNumber = phoneE164.replace(/^\+/, '');
  const gmailId = resourceName?.split('/').pop();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  useEffect(() => {
    if (open && resourceName && !email && onMissingEmail) onMissingEmail();
  }, [open, resourceName, email, onMissingEmail]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        className="underline"
        style={{ color: 'var(--ink-soft)' }}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
      >{label}</button>
      {open && (
        <div
          className="absolute z-10 mt-1 rounded-lg border shadow-lg p-1 min-w-[180px]"
          style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <a className="block px-3 py-2 rounded hover:bg-gray-100" href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer">📱 WhatsApp</a>
          <a className="block px-3 py-2 rounded hover:bg-gray-100" href={`tel:${phoneE164}`}>📞 Chiama</a>
          {email && (
            <a className="block px-3 py-2 rounded hover:bg-gray-100" href={`mailto:${email}`}>✉️ Email</a>
          )}
          {gmailId && (
            <>
              <div className="my-1 border-t" style={{ borderColor: 'var(--line)' }} />
              <a className="block px-3 py-2 rounded hover:bg-gray-100" href={`https://contacts.google.com/person/${gmailId}`} target="_blank" rel="noreferrer">👤 Apri in Gmail</a>
            </>
          )}
        </div>
      )}
    </div>
  );
};
