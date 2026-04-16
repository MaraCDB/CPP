import { Modal } from './Modal';

interface Props {
  open: boolean;
  name: string;
  phoneE164: string;
  onConfirm: () => void;
  onSkip: () => void;
}

export const ConfirmCreateContactModal = ({ open, name, phoneE164, onConfirm, onSkip }: Props) => {
  if (!open) return null;
  return (
    <Modal open onClose={onSkip} title="Aggiungere a rubrica Gmail?">
      <div className="p-4">
        <p className="mb-3">Il numero <strong>{phoneE164}</strong> non è nei tuoi contatti Gmail.</p>
        <p className="mb-4">Vuoi aggiungere <strong>{name || 'questo ospite'}</strong> alla rubrica?</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onSkip}>No, salta</button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>Aggiungi a Gmail</button>
        </div>
      </div>
    </Modal>
  );
};
