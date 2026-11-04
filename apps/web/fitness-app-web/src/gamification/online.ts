import { getCloudClient, getCloudSession } from '../cloud';
import type { Visibility } from './types';

export type OnlineScope = 'global' | 'friends' | 'country';
export type OnlineRow = { userId: string; name: string; country: string | null; score: number; position: number; self: boolean };
export type SubmitResult = { status: 'ok' | 'capped' | 'rejected' | 'rate_limited'; message: string; friendCode?: string };

export type ScorePayload = { name: string; country: string; visibility: Visibility; hideRankings: boolean; logos: number; muscles: Record<string, number> };

/** Valida en cliente lo mismo que el servidor; el servidor es la autoridad y vuelve a comprobarlo. */
export function validatePayload(payload: ScorePayload): string | null {
  const inRange = (value: number) => Number.isFinite(value) && value >= 0 && value <= 10000;
  if (!inRange(payload.logos)) return 'Puntuación fuera de rango.';
  if (Object.values(payload.muscles).some((value) => !inRange(value))) return 'Puntuación muscular fuera de rango.';
  if (payload.country && !/^[A-Z]{2}$/.test(payload.country)) return 'El país debe ser un código de 2 letras (ES, MX, AR…).';
  return null;
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const client = getCloudClient();
  if (!client) throw new Error('La nube no está configurada.');
  if (!(await getCloudSession())) throw new Error('Inicia sesión en la nube (sección Usuarios) para usar la clasificación online.');
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message.includes('Could not find the function') ? 'Falta ejecutar supabase/leaderboard.sql en tu proyecto.' : error.message);
  return data as T;
}

export async function submitScore(payload: ScorePayload): Promise<SubmitResult> {
  const invalid = validatePayload(payload);
  if (invalid) return { status: 'rejected', message: invalid };
  const result = await rpc<{ status: SubmitResult['status']; reason?: string; friend_code?: string }>('submit_score', {
    p_name: payload.name,
    p_country: payload.country || null,
    p_visibility: payload.visibility,
    p_hide: payload.hideRankings,
    p_logos: Math.round(payload.logos),
    p_muscles: payload.muscles,
  });
  const messages = { ok: 'Puntuación publicada.', capped: 'Publicada con límite: la subida diaria máxima está acotada por el servidor.', rejected: result.reason ?? 'Rechazada por el servidor.', rate_limited: result.reason ?? 'Espera unos segundos.' };
  return { status: result.status, message: messages[result.status], friendCode: result.friend_code };
}

export async function fetchLeaderboard(metric: string, scope: OnlineScope): Promise<OnlineRow[]> {
  const rows = await rpc<Array<{ user_id: string; display_name: string; country: string | null; score: number; position: number; is_self: boolean }>>('get_leaderboard', { p_metric: metric, p_scope: scope, p_limit: 50 });
  return (rows ?? []).map((row) => ({ userId: row.user_id, name: row.display_name, country: row.country, score: row.score, position: Number(row.position), self: row.is_self }));
}

export async function sendFriendRequest(code: string): Promise<'pending' | 'accepted' | 'not_found'> {
  const result = await rpc<{ status: 'pending' | 'accepted' | 'not_found' }>('send_friend_request', { p_code: code });
  return result.status;
}

export const listFriendRequests = () => rpc<Array<{ requester: string; display_name: string }>>('list_friend_requests', {});
export const respondFriendRequest = (requester: string, accept: boolean) => rpc<void>('respond_friend_request', { p_requester: requester, p_accept: accept });

export async function reportScore(userId: string, reason: string): Promise<boolean> {
  const result = await rpc<{ status: string; flagged?: boolean }>('report_score', { p_user: userId, p_reason: reason });
  return result.status === 'ok';
}
