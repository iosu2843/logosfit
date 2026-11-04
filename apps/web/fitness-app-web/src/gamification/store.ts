import { useCallback, useState } from 'react';
import { saveItem } from '../cloud';
import { isValidCustom } from './milestones';
import type { CustomMilestone, GamState, Visibility } from './types';

export const GAM_KEY = 'fitness-gamification-by-profile';

export const defaultGamState = (): GamState => ({
  version: 1,
  initialized: false,
  visits: [],
  charts: [],
  reviews: [],
  reportViews: [],
  routineEdits: [],
  firstSeen: {},
  seen: [],
  showcase: [],
  visibility: 'private',
  hideRankings: false,
  sound: false,
  custom: [],
});

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: unknown, max = 800): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(-max) : []);

export function normalizeGamState(raw: unknown): GamState {
  const base = defaultGamState();
  if (!isRecord(raw)) return base;
  const firstSeen: Record<string, string> = {};
  if (isRecord(raw.firstSeen)) Object.entries(raw.firstSeen).forEach(([key, value]) => typeof value === 'string' && (firstSeen[key] = value));
  const custom = Array.isArray(raw.custom) ? (raw.custom as CustomMilestone[]).filter((item) => isRecord(item) && typeof item.id === 'string' && typeof item.exercise === 'string' && isValidCustom(item)).slice(0, 20) : [];
  return {
    version: 1,
    initialized: raw.initialized === true,
    visits: strings(raw.visits),
    charts: strings(raw.charts),
    reviews: strings(raw.reviews, 60),
    reportViews: strings(raw.reportViews),
    routineEdits: strings(raw.routineEdits, 400),
    firstSeen,
    seen: strings(raw.seen, 2000),
    showcase: strings(raw.showcase, 6).slice(0, 6),
    visibility: (['private', 'friends', 'public'] as Visibility[]).includes(raw.visibility as Visibility) ? (raw.visibility as Visibility) : 'private',
    hideRankings: raw.hideRankings === true,
    sound: raw.sound === true,
    custom,
  };
}

function readAll(): Record<string, unknown> {
  try {
    const parsed = JSON.parse(localStorage.getItem(GAM_KEY) ?? '{}');
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export const readGamState = (scopeId: string): GamState => normalizeGamState(readAll()[scopeId]);

export function useGamState(scopeId: string) {
  const [state, setState] = useState(() => ({ scopeId, data: readGamState(scopeId) }));
  const data = state.scopeId === scopeId ? state.data : readGamState(scopeId);

  const update = useCallback(
    (change: (current: GamState) => GamState) => {
      setState((previous) => {
        const current = previous.scopeId === scopeId ? previous.data : readGamState(scopeId);
        const next = change(current);
        if (next !== current) saveItem(GAM_KEY, JSON.stringify({ ...readAll(), [scopeId]: next }));
        return { scopeId, data: next };
      });
    },
    [scopeId],
  );

  return [data, update] as const;
}

/** Añade una fecha a una lista de eventos sin duplicados. Devuelve el mismo estado si ya estaba. */
export function withDate(state: GamState, field: 'visits' | 'charts' | 'reviews' | 'reportViews' | 'routineEdits', date: string): GamState {
  if (state[field].includes(date)) return state;
  return { ...state, [field]: [...state[field], date] };
}
