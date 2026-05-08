import { useAuth } from '../../store/auth';
import { signOut } from '../../lib/firebase/auth';

export const AccountSection = () => {
  const user = useAuth(s => s.user);
  if (!user) return null;

  const onLogout = () => {
    if (!window.confirm('Vuoi davvero uscire? Tornerai alla schermata di accesso.')) return;
    void signOut();
  };

  return (
    <section className="mt-6">
      <h3 className="font-semibold mb-2">Account</h3>
      <div className="text-sm mb-2">{user.email}</div>
      <button className="btn btn-ghost" onClick={onLogout}>Esci</button>
    </section>
  );
};
