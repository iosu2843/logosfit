import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  getCloudSession,
  isCloudConfigured,
  listCloudBackups,
  onSyncStatus,
  restoreCloudBackup,
  signInWithPassword,
  signOutCloud,
  signUpWithPassword,
  syncNow,
  type CloudBackup,
  type SyncStatus,
} from './cloud';

const statusText: Record<SyncStatus, string> = {
  disabled: 'Nube no configurada',
  'signed-out': 'Sin sesión',
  syncing: 'Sincronizando…',
  synced: 'Guardado en la nube',
  error: 'Error de sincronización',
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function parseBackupItem(backup: CloudBackup, key: string): unknown {
  const raw = backup.data.items[key];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function summarizeBackup(backup: CloudBackup): string {
  const summary: string[] = [];
  const profiles = parseBackupItem(backup, 'fitness-profiles');
  if (Array.isArray(profiles) && profiles.length > 0) {
    summary.push(`${profiles.length} perfil${profiles.length === 1 ? '' : 'es'}`);
  }

  const workoutProfiles = asRecord(parseBackupItem(backup, 'fitness-workout-log-by-profile'));
  let sessions = 0;
  Object.values(workoutProfiles ?? {}).forEach((profileLog) => {
    Object.values(asRecord(profileLog) ?? {}).forEach((day) => {
      const exercises = asRecord(asRecord(day)?.exercises);
      if (Object.values(exercises ?? {}).some((entry) => Number(asRecord(entry)?.sets) > 0)) sessions += 1;
    });
  });
  if (sessions > 0) summary.push(`${sessions} entrenamiento${sessions === 1 ? '' : 's'}`);

  const plans = asRecord(parseBackupItem(backup, 'fitness-training-plans-by-profile'));
  let routineDays = 0;
  Object.values(plans ?? {}).forEach((profilePlans) => {
    Object.values(asRecord(profilePlans) ?? {}).forEach((day) => {
      const exercises = asRecord(day)?.exercises;
      if (Array.isArray(exercises) && exercises.length > 0) routineDays += 1;
    });
  });
  if (routineDays > 0) summary.push(`${routineDays} día${routineDays === 1 ? '' : 's'} de rutina`);

  const customExerciseProfiles = asRecord(parseBackupItem(backup, 'fitness-custom-exercises-by-profile'));
  const customExercises = Object.values(customExerciseProfiles ?? {}).reduce<number>(
    (total, exercises) => total + (Array.isArray(exercises) ? exercises.length : 0),
    0,
  );
  if (customExercises > 0) summary.push(`${customExercises} ejercicio${customExercises === 1 ? '' : 's'} personalizado${customExercises === 1 ? '' : 's'}`);

  const nutritionProfiles = asRecord(parseBackupItem(backup, 'fitness-nutrition-by-profile'));
  let nutritionEntries = 0;
  Object.values(nutritionProfiles ?? {}).forEach((profileNutrition) => {
    const days = asRecord(asRecord(profileNutrition)?.entriesByDay);
    Object.values(days ?? {}).forEach((entries) => {
      if (Array.isArray(entries)) nutritionEntries += entries.length;
    });
  });
  if (nutritionEntries > 0) summary.push(`${nutritionEntries} registro${nutritionEntries === 1 ? '' : 's'} de nutrición`);

  const savedCategories: Array<[string, string]> = [
    ['fitness-progress-history-by-profile', 'historial de progreso'],
    ['fitness-calendar-metrics-by-profile', 'métricas del calendario'],
    ['fitness-weekly-rotation-by-profile', 'alternancia semanal'],
    ['fitness-gamification-by-profile', 'progreso de logros'],
  ];
  savedCategories.forEach(([key, label]) => {
    const value = parseBackupItem(backup, key);
    if (value && Object.keys(asRecord(value) ?? {}).length > 0) summary.push(label);
  });

  return summary.length > 0 ? summary.join(' · ') : 'Copia inicial sin datos de entrenamiento registrados.';
}

function formatBackupDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function CloudPanel() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>(isCloudConfigured ? 'signed-out' : 'disabled');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [backups, setBackups] = useState<CloudBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<number | null>(null);
  const [restoringBackupId, setRestoringBackupId] = useState<number | null>(null);

  const runSync = useCallback(async () => {
    try {
      if ((await syncNow()) === 'pulled') window.location.reload();
    } catch {
      // The error state is reported through onSyncStatus.
    }
  }, []);

  const refreshBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      setBackups(await listCloudBackups());
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron cargar las copias.');
    } finally {
      setLoadingBackups(false);
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
      void refreshBackups();
    }).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'No se pudo comprobar la sesión.');
    });
    return () => {
      unsubscribe();
    };
  }, [refreshBackups]);

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
      await refreshBackups();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesión');
    } finally {
      setBusy(false);
    }
  };

  const restore = async (backupId: number) => {
    setRestoringBackupId(backupId);
    setMessage('');
    try {
      await restoreCloudBackup(backupId);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo restaurar la copia.');
      setRestoringBackupId(null);
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
            <button className="danger-btn" type="button" onClick={async () => { await signOutCloud(); setSessionEmail(null); setStatus('signed-out'); setBackups([]); setRestoreCandidate(null); }}>Cerrar sesión</button>
          </div>
          <div className="cloud-backups">
            <div className="cloud-backups-heading">
              <h4>Copias de seguridad</h4>
              <button className="cloud-refresh-btn" type="button" disabled={loadingBackups} onClick={() => void refreshBackups()}>
                {loadingBackups ? 'Cargando…' : 'Actualizar'}
              </button>
            </div>
            <p className="cloud-note">Cada versión incluye un resumen de sus datos. Al restaurarla, el estado actual se conservará como una copia anterior.</p>
            {loadingBackups && backups.length === 0 ? (
              <p className="cloud-note">Buscando copias guardadas…</p>
            ) : backups.length === 0 ? (
              <p className="cloud-note">Todavía no hay copias disponibles.</p>
            ) : (
              <div className="cloud-backup-list">
                {backups.map((backup, index) => (
                  <article className="cloud-backup-card" key={backup.id}>
                    <div className="cloud-backup-title">
                      <strong>{formatBackupDate(backup.createdAt)}</strong>
                      {index === 0 && <span>Más reciente</span>}
                    </div>
                    <p className="cloud-backup-summary">{summarizeBackup(backup)}</p>
                    {restoreCandidate === backup.id ? (
                      <div className="cloud-restore-confirm" role="group" aria-label="Confirmar restauración">
                        <p>Se sustituirán los datos actuales de tu cuenta por esta versión. La versión actual quedará guardada antes de restaurar.</p>
                        <div className="cloud-actions">
                          <button className="primary-btn" type="button" disabled={restoringBackupId !== null} onClick={() => void restore(backup.id)}>
                            {restoringBackupId === backup.id ? 'Restaurando…' : 'Confirmar restauración'}
                          </button>
                          <button className="ghost-btn" type="button" disabled={restoringBackupId !== null} onClick={() => setRestoreCandidate(null)}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button className="cloud-restore-btn" type="button" disabled={restoringBackupId !== null} onClick={() => setRestoreCandidate(backup.id)}>
                        Restaurar esta versión
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
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
