import { signIn } from '../lib/google/auth';

export const SignIn = () => (
  <section className="home" style={{ textAlign: 'center' }}>
    <div className="home-hero">
      <div className="logo" style={{ background:'linear-gradient(135deg,var(--lampone),var(--mirtillo))' }}>🏡</div>
      <h1>Cuore di Bosco</h1>
      <p>Calendario prenotazioni</p>
    </div>
    <div style={{ maxWidth: 360 }}>
      <p className="mb-4 text-sm" style={{ color:'var(--ink-soft)' }}>
        Accedi con Google per sincronizzare le prenotazioni tra tutti i tuoi dispositivi.
      </p>
      <button className="btn btn-primary w-full" onClick={signIn}>Accedi con Google</button>
    </div>
  </section>
);
