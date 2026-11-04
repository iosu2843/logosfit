export type Division = { id: string; name: string; min: number };

/** Umbrales iniciales de puntuación muscular (0-10000), ajustables. */
export const divisions: Division[] = [
  { id: 'academia', name: 'Academia', min: 0 },
  { id: 'bronce', name: 'Bronce', min: 500 },
  { id: 'plata', name: 'Plata', min: 1200 },
  { id: 'oro', name: 'Oro', min: 2000 },
  { id: 'platino', name: 'Platino', min: 3000 },
  { id: 'estoicos', name: 'Estoicos', min: 4200 },
  { id: 'olimpicos', name: 'Olímpicos', min: 5400 },
  { id: 'semidioses', name: 'Semidioses', min: 6600 },
  { id: 'titanes', name: 'Titanes', min: 7800 },
  { id: 'olimpo', name: 'Olimpo', min: 9000 },
];

export function divisionIndex(score: number): number {
  let index = 0;
  divisions.forEach((division, i) => {
    if (score >= division.min) index = i;
  });
  return index;
}

export const divisionFor = (score: number) => divisions[divisionIndex(score)];

export function nextDivision(score: number): { division: Division; missing: number } | null {
  const next = divisions[divisionIndex(score) + 1];
  return next ? { division: next, missing: next.min - score } : null;
}

export type SeasonConfig = { promotePct: number; demotePct: number; minParticipants: number };
export const seasonConfig: SeasonConfig = { promotePct: 0.2, demotePct: 0.2, minParticipants: 5 };

export type Participant = { id: string; score: number; division: number };
export type SeasonOutcome = 'asciende' | 'desciende' | 'permanece';

/**
 * Cierre de temporada dentro de una división: asciende el mejor porcentaje (solo si su puntuación alcanza el mínimo de la división
 * siguiente), desciende el peor y el resto permanece. Con pocos participantes nadie cambia por clasificación.
 */
export function settleSeason(participants: Participant[], config: SeasonConfig = seasonConfig): Record<string, SeasonOutcome> {
  const outcome: Record<string, SeasonOutcome> = {};
  participants.forEach((p) => (outcome[p.id] = 'permanece'));
  const byDivision = new Map<number, Participant[]>();
  participants.forEach((p) => byDivision.set(p.division, [...(byDivision.get(p.division) ?? []), p]));
  byDivision.forEach((group, division) => {
    if (group.length < config.minParticipants) return;
    const sorted = [...group].sort((a, b) => b.score - a.score);
    const up = Math.max(1, Math.floor(sorted.length * config.promotePct));
    const down = Math.max(1, Math.floor(sorted.length * config.demotePct));
    const next = divisions[division + 1];
    sorted.slice(0, up).forEach((p) => {
      if (next && p.score >= next.min) outcome[p.id] = 'asciende';
    });
    if (division > 0) sorted.slice(-down).forEach((p) => {
      if (outcome[p.id] === 'permanece' && p.score < divisions[division].min) outcome[p.id] = 'desciende';
    });
  });
  return outcome;
}
