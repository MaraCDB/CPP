import { useUI } from '../../store/ui';
import { useBookings } from '../../store/bookings';
import { parseISO, nightsBetween } from '../../lib/date';
import type { Prenotazione } from '../../types';
import { ContactMenu } from './ContactMenu';
import { toE164 } from '../../lib/phone';
import { getContact } from '../../lib/google/people';

const STATE_LABEL = { proposta: 'Proposta', anticipo_atteso: 'Anticipo atteso', confermato: 'Confermato' };
const CONTACT_ICON: Record<string, string> = { telefono: '📞', whatsapp: '💬', mail: '✉️', ota: '🌐' };

const fmt = (d: Date) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

export const BookingCard = ({ b }: { b: Prenotazione }) => {
  const openModal = useUI(s => s.openModal);
  const updateBooking = useBookings(s => s.update);
  const fetchEmail = async () => {
    if (!b.contattoResourceName || b.contattoEmail) return;
    try {
      const c = await getContact(b.contattoResourceName);
      if (c?.email) updateBooking(b.id, { contattoEmail: c.email });
    } catch { /* ignore */ }
  };
  const ci = parseISO(b.checkin), co = parseISO(b.checkout);
  const nights = nightsBetween(b.checkin, b.checkout);
  const emoji = b.camera === 'lampone' ? '🍇' : '🫐';
  const phoneE164 = b.contattoVia === 'telefono' && b.contattoValore ? toE164(b.contattoValore) : null;

  return (
    <div className="rounded-xl p-3 mb-2 border cursor-pointer hover:bg-gray-50"
      style={{ borderColor: 'var(--line)' }}
      onClick={() => openModal({ kind: 'booking', id: b.id })}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-semibold">{emoji} {b.nome}{b.riferimento && <span className="text-[11px] ml-1" style={{ color: 'var(--ink-soft)' }}>({b.riferimento})</span>}</div>
        <span className={`pill ${b.stato}`}>{STATE_LABEL[b.stato]}</span>
      </div>
      <div className="text-[13px]" style={{ color: 'var(--ink-soft)' }}>
        {fmt(ci)} → {fmt(co)} · {nights} nott{nights === 1 ? 'e' : 'i'}{b.prezzoTotale ? ` · €${b.prezzoTotale}` : ''}
      </div>
      {b.contattoVia && b.contattoValore && (
        <div
          className="text-[12px] flex items-center gap-1"
          style={{ color: 'var(--ink-soft)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <span>{CONTACT_ICON[b.contattoVia]}</span>
          {phoneE164 ? (
            <>
              <ContactMenu
                phoneE164={phoneE164}
                label={b.contattoValore}
                email={b.contattoEmail}
                resourceName={b.contattoResourceName}
                onMissingEmail={fetchEmail}
              />
              {b.contattoResourceName && (
                <span title="Contatto Gmail collegato" style={{ color: '#22c55e' }}>●</span>
              )}
            </>
          ) : (
            <span>{b.contattoValore}</span>
          )}
        </div>
      )}
      {b.anticipo && <div className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>
        Anticipo: €{b.anticipo.importo}{b.anticipo.tipo ? ' · ' + b.anticipo.tipo.replace('_', ' ') : ''}{b.anticipo.data ? ' · ' + fmt(parseISO(b.anticipo.data)) : ''}
      </div>}
      {b.note && <div className="text-[12px] italic mt-1" style={{ color: 'var(--ink-soft)' }}>« {b.note} »</div>}
    </div>
  );
};
