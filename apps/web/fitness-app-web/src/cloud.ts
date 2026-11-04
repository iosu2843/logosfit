import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isCloudConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const syncedKeys = [
  'fitness-profiles',
  'fitness-active-profile',
  'fitness-calendar-metrics-by-profile',
  'fitness-completed-exercises-by-profile',
  'fitness-progress-history-by-profile',
  'fitness-workout-log-by-profile',
  'fitness-nutrition-by-profile',
  'fitness-nutrition-ai-by-profile',
  'fitness-training-plans-by-profile',
  'fitness-gamification-by-profile',
] as const;

const updatedAtKey = 'fitness-updated-at';
const pushDelayMs = 1500;

type CloudSnapshot = { updatedAt: number; items: Record<string, string> };
export type SyncStatus = 'disabled' | 'signed-out' | 'syncing' | 'synced' | 'error';
export type SyncResult = 'pushed' | 'pulled' | 'unchanged';

const client: SupabaseClient | null = isCloudConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export const getCloudClient = () => client;

let pushTimer: number | undefined;
let signedIn = false;
const statusListeners = new Set<(status: SyncStatus, message?: string) => void>();

function emit(status: SyncStatus, message?: string) {
  statusListeners.forEach((listener) => listener(status, message));
}

export function onSyncStatus(listener: (status: SyncStatus, message?: string) => void) {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

function readUpdatedAt() {
  return Number(localStorage.getItem(updatedAtKey)) || 0;
}

function buildSnapshot(): CloudSnapshot {
  const items: Record<string, string> = {};
  syncedKeys.forEach((key) => {
    const value = localStorage.getItem(key);
    if (value !== null) items[key] = value;
  });
  return { updatedAt: readUpdatedAt(), items };
}

function applySnapshot(snapshot: CloudSnapshot) {
  syncedKeys.forEach((key) => {
    if (key in snapshot.items) localStorage.setItem(key, snapshot.items[key]);
    else localStorage.removeItem(key);
  });
  localStorage.setItem(updatedAtKey, String(snapshot.updatedAt));
}

async function currentUserId() {
  const { data } = await client!.auth.getSession();
  return data.session?.user.id ?? null;
}

async function pushSnapshot(userId: string) {
  const snapshot = buildSnapshot();
  const { error } = await client!
    .from('app_state')
    .upsert({ user_id: userId, data: snapshot, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function syncNow(): Promise<SyncResult> {
  if (!client) return 'unchanged';
  const userId = await currentUserId();
  if (!userId) return 'unchanged';

  emit('syncing');
  try {
    window.clearTimeout(pushTimer);
    const { data, error } = await client.from('app_state').select('data').eq('user_id', userId).maybeSingle();
    if (error) throw error;

    const remote = data?.data as CloudSnapshot | undefined;
    const localUpdatedAt = readUpdatedAt();
    let result: SyncResult = 'unchanged';

    if (remote && remote.updatedAt > localUpdatedAt) {
      applySnapshot(remote);
      result = 'pulled';
    } else if (!remote || remote.updatedAt < localUpdatedAt) {
      if (localUpdatedAt === 0) localStorage.setItem(updatedAtKey, String(Date.now()));
      await pushSnapshot(userId);
      result = 'pushed';
    }

    emit('synced');
    return result;
  } catch (error) {
    emit('error', error instanceof Error ? error.message : 'No se pudo sincronizar');
    throw error;
  }
}

function schedulePush() {
  if (!client || !signedIn) return;
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(async () => {
    try {
      const userId = await currentUserId();
      if (!userId) return;
      emit('syncing');
      await pushSnapshot(userId);
      emit('synced');
    } catch (error) {
      emit('error', error instanceof Error ? error.message : 'No se pudo guardar en la nube');
    }
  }, pushDelayMs);
}

export function saveItem(key: string, value: string) {
  localStorage.setItem(key, value);
  if ((syncedKeys as readonly string[]).includes(key)) {
    localStorage.setItem(updatedAtKey, String(Date.now()));
    schedulePush();
  }
}

export function removeItem(key: string) {
  localStorage.removeItem(key);
  if ((syncedKeys as readonly string[]).includes(key)) {
    localStorage.setItem(updatedAtKey, String(Date.now()));
    schedulePush();
  }
}

export async function getCloudSession(): Promise<Session | null> {
  if (!client) return null;
  const { data } = await client.auth.getSession();
  signedIn = Boolean(data.session);
  return data.session;
}

export async function signInWithPassword(email: string, password: string) {
  if (!client) throw new Error('La nube no está configurada');
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  signedIn = true;
}

export async function signUpWithPassword(email: string, password: string): Promise<'signed-in' | 'confirm-email'> {
  if (!client) throw new Error('La nube no está configurada');
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  signedIn = Boolean(data.session);
  return data.session ? 'signed-in' : 'confirm-email';
}

export async function signOutCloud() {
  if (!client) return;
  window.clearTimeout(pushTimer);
  await client.auth.signOut();
  signedIn = false;
  emit('signed-out');
}

export async function startCloudSync() {
  if (!client) return;
  const refresh = async () => {
    try {
      if ((await syncNow()) === 'pulled') window.location.reload();
    } catch {
      // Status listeners already receive the error.
    }
  };
  if (await getCloudSession()) {
    await Promise.race([refresh(), new Promise((resolve) => window.setTimeout(resolve, 4000))]);
  }
  window.addEventListener('focus', () => {
    if (signedIn) void refresh();
  });
}
