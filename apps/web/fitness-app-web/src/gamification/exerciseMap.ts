import { exerciseLibrary } from '../exerciseLibrary';
import type { LeagueMuscle } from './types';

export type MuscleWeights = Partial<Record<LeagueMuscle, number>>;

const groupToMuscle: Record<string, LeagueMuscle | undefined> = {
  Pecho: 'Pecho',
  Espalda: 'Espalda',
  Hombros: 'Hombros',
  'Bíceps': 'Bíceps',
  'Tríceps': 'Tríceps',
  'Cuádriceps': 'Piernas',
  Isquiotibiales: 'Piernas',
  'Glúteos': 'Piernas',
  Gemelos: 'Piernas',
  Core: 'Abdomen',
};

/**
 * Reparto configurable de cada serie entre grupos musculares. No son porcentajes fisiológicos de activación:
 * solo evitan contar una serie completa para todos los músculos implicados. Cada reparto suma 1.
 */
const overrides: Array<[RegExp, MuscleWeights]> = [
  [/agarre cerrado|press jm/i, { 'Tríceps': 0.6, Pecho: 0.4 }],
  [/fondos para pecho/i, { Pecho: 0.7, 'Tríceps': 0.3 }],
  [/fondos en paralelas/i, { 'Tríceps': 0.7, Pecho: 0.3 }],
  [/aperturas|cruces|peck deck(?! inverso)/i, { Pecho: 0.9, Hombros: 0.1 }],
  [/press (banca|inclinado|declinado|de pecho|de suelo)|flexiones/i, { Pecho: 0.7, 'Tríceps': 0.2, Hombros: 0.1 }],
  [/jal[oó]n|dominadas|colgarse/i, { Espalda: 0.7, 'Bíceps': 0.3 }],
  [/pullover/i, { Espalda: 0.8, Pecho: 0.2 }],
  [/peso muerto convencional|peso muerto sumo/i, { Espalda: 0.5, Piernas: 0.5 }],
  [/remo/i, { Espalda: 0.75, 'Bíceps': 0.25 }],
  [/press (militar|de hombros|arnold)|pica|landmine/i, { Hombros: 0.75, 'Tríceps': 0.25 }],
];

const libraryByName = new Map(exerciseLibrary.map((exercise) => [exercise.name, exercise]));

export function exerciseEquipment(name: string): string | null {
  return libraryByName.get(name)?.equipment ?? null;
}

export function muscleWeights(name: string, fallbackGroup?: string): MuscleWeights {
  const group = libraryByName.get(name)?.group ?? fallbackGroup;
  if (!group || group === 'Cardio') return {};
  const rule = overrides.find(([pattern]) => pattern.test(name));
  if (rule) return rule[1];
  const muscle = groupToMuscle[group];
  return muscle ? { [muscle]: 1 } : {};
}

export function primaryMuscle(name: string, fallbackGroup?: string): LeagueMuscle | null {
  const weights = Object.entries(muscleWeights(name, fallbackGroup)) as Array<[LeagueMuscle, number]>;
  if (weights.length === 0) return null;
  return weights.sort((a, b) => b[1] - a[1])[0][0];
}

export const isCardioExercise = (name: string, group?: string) => group === 'Cardio' || libraryByName.get(name)?.group === 'Cardio';
