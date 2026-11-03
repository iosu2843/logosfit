import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  getCloudSession,
  isCloudConfigured,
  onSyncStatus,
  signInWithPassword,
  signOutCloud,
  signUpWithPassword,
  syncNow,
  type SyncStatus,
} from './cloud';

const statusText: Record<SyncStatus, string> = {
  disabled: 'Nube no configurada',
  'signed-out': 'Sin sesión',
  syncing: 'Sincronizando…',
  synced: 'Guardado en la nube',
  error: 'Error de sincronización',
};

export default function CloudPanel() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>(isCloudConfigured ? 'signed-out' : 'disabled');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const runSync = useCallback(async () => {
    try {
      if ((await syncNow()) === 'pulled') window.location.reload();
    } catch {
      // The error state is reported through onSyncStatus.
    }
  }, []);

  useEffect(() => {
    if (!isCloudConfigured) return;
    const unsubscribe = onSyncStatus((next, detail) => {
      setStatus(next);
      if (next === 'error') setMessage(detail ?? '');
    });
    getCloudSession().then((session) => {
      if (!session) return;
      setSessionEmail(session.user.email ?? '');
      setStatus('synced');
    });
    return () => {
      unsubscribe();
    };
  }, [runSync]);

  const authenticate = async (mode: 'signin' | 'signup', event?: FormEvent) => {
    event?.preventDefault();
    if (!email.trim() || password.length < 6) {
      setMessage('Introduce un correo y una contraseña de al menos 6 caracteres.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'signin') {
        await signInWithPassword(email.trim(), password);
      } else if ((await signUpWithPassword(email.trim(), password)) === 'confirm-email') {
        setMessage('Cuenta creada. Confirma tu correo y vuelve a iniciar sesión.');
        return;
      }
      setSessionEmail(email.trim());
      setPassword('');
      await runSync();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesión');
    } finally {
      setBusy(false);
    }
  };

  if (!isCloudConfigured) {
    return (
      <section className="cloud-panel" aria-label="Cuenta en la nube">
        <h3>Cuenta en la nube</h3>
        <p className="cloud-note">Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para sincronizar tus usuarios entre dispositivos. Mientras tanto los datos se guardan solo en este navegador.</p>
      </section>
    );
  }

  return (
    <section className="cloud-panel" aria-label="Cuenta en la nube">
      <div className="cloud-header">
        <h3>Cuenta en la nube</h3>
        <span className={`cloud-status ${status}`}>{statusText[status]}</span>
      </div>
      {sessionEmail ? (
        <>
          <p className="cloud-note">Sesión iniciada como <strong>{sessionEmail}</strong>. Tus usuarios y cambios se guardan automáticamente y se sincronizan en cualquier dispositivo.</p>
          <div className="cloud-actions">
            <button className="ghost-btn" type="button" onClick={() => void runSync()}>Sincronizar ahora</button>
            <button className="danger-btn" type="button" onClick={async () => { await signOutCloud(); setSessionEmail(null); setStatus('signed-out'); }}>Cerrar sesión</button>
          </div>
        </>
      ) : (
        <form className="cloud-form" onSubmit={(event) => authenticate('signin', event)}>
          <input aria-label="Correo electrónico" type="email" autoComplete="email" placeholder="Correo" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input aria-label="Contraseña" type="password" autoComplete="current-password" placeholder="Contraseña" value={password} onChange={(event) => setPassword(event.target.value)} />
          <div className="cloud-actions">
            <button className="primary-btn" type="submit" disabled={busy}>Iniciar sesión</button>
            <button className="ghost-btn" type="button" disabled={busy} onClick={() => authenticate('signup')}>Crear cuenta</button>
          </div>
        </form>
      )}
      {message && <p className="cloud-message" role="status">{message}</p>}
    </section>
  );
}
