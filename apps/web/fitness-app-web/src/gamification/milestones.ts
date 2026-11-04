import type { CustomMilestone, LeagueMuscle, Tier, ValidSet } from './types';

export type MilestoneMetric = 'weight' | 'reps' | 'seconds';

/** Hito de fuerza por ejercicio concreto. Cada máquina o variante se valora por separado: nunca se mezclan cargas de equipos distintos. */
export type MilestoneDef = {
  id: string;
  muscle: LeagueMuscle;
  exercise: string;
  metric: MilestoneMetric;
  steps: number[];
  /** Serie filosófica con la que se nombran los escalones. */
  series: string;
  /** Peso añadido (lastre) en lugar de peso total. */
  added?: boolean;
  names?: string[];
};

export const DEFAULT_MIN_REPS = 3;

const AR = 'El escudo de Ares';
const ATL = 'El titán de Atlas';
const AQ = 'La fuerza de Aquiles';
const ATE = 'La armadura de Atenea';
const HEF = 'El brazo de Hefesto';
const PRO = 'El núcleo de Prometeo';

const w = (id: string, muscle: LeagueMuscle, exercise: string, steps: number[], series: string, names?: string[]): MilestoneDef => ({ id, muscle, exercise, metric: 'weight', steps, series, names });

/** Umbrales iniciales configurables. No son estándares universales de fuerza. */
export const ironMilestones: MilestoneDef[] = [
  w('press-sentado', 'Pecho', 'Press de pecho sentado', [40, 60, 80, 100], AR, ['El escudo de Ares', 'La fuerza de Heracles', 'El héroe de Tebas', 'El coloso']),
  w('press-convergente', 'Pecho', 'Press de pecho convergente', [40, 60, 80, 100], AR, ['El escudo de Ares', 'La fuerza de Heracles', 'El héroe de Tebas', 'El coloso']),
  w('press-banca', 'Pecho', 'Press banca', [40, 60, 80, 100, 120], AR),
  w('press-inclinado', 'Pecho', 'Press inclinado con barra', [30, 50, 70, 90], AR),
  w('aperturas-peck', 'Pecho', 'Aperturas en peck deck', [30, 45, 60, 75], AR),
  { id: 'fondos-pecho-reps', muscle: 'Pecho', exercise: 'Fondos para pecho', metric: 'reps', steps: [10, 20, 30], series: AR },
  { id: 'fondos-pecho-lastre', muscle: 'Pecho', exercise: 'Fondos para pecho', metric: 'weight', steps: [10, 20, 30], series: AR, added: true },
  w('jalon', 'Espalda', 'Jalón al pecho agarre amplio', [40, 60, 80, 100], ATL),
  w('remo-maquina', 'Espalda', 'Remo en máquina con pecho apoyado', [40, 60, 80, 100], ATL),
  w('remo-barra', 'Espalda', 'Remo con barra', [40, 60, 80, 100], ATL),
  { id: 'dominadas-reps', muscle: 'Espalda', exercise: 'Dominadas pronas', metric: 'reps', steps: [5, 10, 15, 20], series: ATL },
  { id: 'dominadas-lastre', muscle: 'Espalda', exercise: 'Dominadas pronas', metric: 'weight', steps: [10, 20, 30], series: ATL, added: true },
  w('prensa', 'Piernas', 'Prensa de piernas', [100, 150, 200, 250, 300], AQ, ['Los pasos de Aquiles', 'La resistencia de Leónidas', 'El poder de Cronos', 'La fuerza de Aquiles IV', 'La fuerza de Aquiles V']),
  w('extension-cuad', 'Piernas', 'Extensión de cuádriceps', [30, 45, 60, 75, 90], AQ),
  w('curl-femoral', 'Piernas', 'Curl femoral tumbado', [25, 40, 55, 70, 85], AQ),
  w('sentadilla', 'Piernas', 'Sentadilla trasera', [40, 60, 80, 100, 120, 140, 160], AQ),
  w('peso-muerto', 'Piernas', 'Peso muerto convencional', [60, 100, 140, 180, 220], AQ),
  w('hip-thrust', 'Piernas', 'Hip thrust con barra', [60, 100, 140, 180, 220], AQ),
  w('gemelos', 'Piernas', 'Elevación de gemelos de pie', [40, 60, 80, 100], AQ),
  w('press-hombros-maq', 'Hombros', 'Press de hombros en máquina', [20, 30, 40, 50, 60], ATE, ['La égida de Atenea', 'La armadura de Atenea II', 'La armadura de Atenea III', 'La armadura de Atenea IV', 'El titán']),
  w('press-militar', 'Hombros', 'Press militar de pie', [20, 30, 40, 50, 60], ATE),
  w('laterales', 'Hombros', 'Elevaciones laterales con mancuernas', [5, 8, 10, 12, 15], ATE),
  w('pajaros', 'Hombros', 'Pájaros en peck deck inverso', [20, 30, 40, 50], ATE),
  w('curl-barra', 'Bíceps', 'Curl con barra recta', [20, 30, 40, 50], HEF, ['El martillo de Hefesto', 'El brazo de Hefesto II', 'El brazo de Hefesto III', 'El brazo de Hefesto IV']),
  w('curl-mancuerna', 'Bíceps', 'Curl alterno con mancuernas', [8, 10, 12, 15, 20], HEF),
  w('curl-maquina', 'Bíceps', 'Curl predicador en máquina', [20, 30, 40, 50], HEF),
  w('triceps-polea', 'Tríceps', 'Extensión de tríceps en polea', [20, 30, 40, 50, 60], HEF, ['El brazo de Hefesto I', 'El brazo de Hefesto II', 'El brazo de Hefesto III', 'La fuerza de Ares', 'El brazo de Hefesto V']),
  w('triceps-maquina', 'Tríceps', 'Extensión de tríceps en máquina', [25, 40, 55, 70], HEF),
  w('crunch-polea', 'Abdomen', 'Crunch en polea', [20, 30, 40, 50, 60], PRO),
  { id: 'piernas-colgado', muscle: 'Abdomen', exercise: 'Elevación de piernas colgado', metric: 'reps', steps: [10, 20, 30], series: PRO },
  { id: 'plancha', muscle: 'Abdomen', exercise: 'Plancha frontal', metric: 'seconds', steps: [60, 90, 120, 180], series: PRO, names: ['La voluntad de Sócrates', 'El núcleo de Prometeo II', 'El núcleo de Prometeo III', 'El dominio estoico'] },
];

const stepTiers: Tier[] = ['bronce', 'plata', 'oro', 'platino', 'legendario', 'legendario', 'legendario'];
export const ironTier = (index: number): Tier => stepTiers[Math.min(index, stepTiers.length - 1)];
export const ironXp: Record<Tier, number> = { bronce: 40, plata: 80, oro: 150, platino: 300, legendario: 500 };

export const metricUnit = (metric: MilestoneMetric, added?: boolean) => (metric === 'reps' ? 'repeticiones' : metric === 'seconds' ? 'segundos' : added ? 'kg añadidos' : 'kg');

/**
 * Mejor valor válido de un ejercicio para una métrica. El peso exige un mínimo de repeticiones (no se premian máximos de una repetición
 * salvo que el usuario lo elija); las repeticiones solo cuentan con peso corporal; los segundos se registran en el campo de repeticiones.
 */
export function bestMark(sets: ValidSet[] | undefined, metric: MilestoneMetric, minReps = DEFAULT_MIN_REPS, added = false): number {
  let best = 0;
  (sets ?? []).forEach((set) => {
    if (metric === 'reps') {
      if (set.weight <= 0) best = Math.max(best, set.reps);
    } else if (metric === 'seconds') {
      best = Math.max(best, set.reps);
    } else if (set.reps >= minReps && (!added || set.weight > 0)) {
      best = Math.max(best, set.weight);
    }
  });
  return best;
}

export function customDef(custom: CustomMilestone): MilestoneDef {
  return { id: `custom-${custom.id}`, muscle: 'Pecho', exercise: custom.exercise, metric: custom.metric, steps: [custom.target], series: 'Hito propio' };
}

export function isValidCustom(custom: CustomMilestone): boolean {
  return custom.exercise.length > 0 && Number.isFinite(custom.target) && custom.target > 0 && custom.target <= 1000 && [1, 3, 5, 8, 10].includes(custom.minReps);
}
