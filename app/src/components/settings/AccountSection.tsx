import { useAuth } from '../../store/auth';
import { signOut } from '../../lib/firebase/auth';
import { SettingsSubPage } from './SettingsSubPage';

export const AccountSection = ({ onBack }: { onBack: () => void }) => {
  const user = useAuth(s => s.user);
  if (!user) return null;

  const onLogout = () => {
    if (!window.confirm('Vuoi davvero uscire? Tornerai alla schermata di accesso.')) return;
    void signOut();
  };

  return (
    <SettingsSubPage title="Account" onBack={onBack}>
      <div className="text-sm mb-2">{user.email}</div>
      <button className="btn btn-ghost" onClick={onLogout}>Esci</button>
    </SettingsSubPage>
  );
};
