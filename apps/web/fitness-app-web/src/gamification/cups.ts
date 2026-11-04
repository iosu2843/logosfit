import { divisionFor } from './leagues';
import type { MuscleScore } from './muscle';
import type { AchievementState, Category, LeagueMuscle } from './types';

export type CupLevel = 'ninguna' | 'bronce' | 'plata' | 'oro';
export type Cup = { id: string; name: string; philosopher: string; concept: string; value: number; level: CupLevel; kind: 'filosofica' | 'muscular' | 'general'; hint: string };

export const cupThresholds = { bronce: 0.25, plata: 0.5, oro: 0.8 };

export const cupLevel = (value: number): CupLevel => (value >= cupThresholds.oro ? 'oro' : value >= cupThresholds.plata ? 'plata' : value >= cupThresholds.bronce ? 'bronce' : 'ninguna');

function fraction(achievements: AchievementState[], categories: Category[]) {
  const list = achievements.filter((item) => categories.includes(item.def.category) && !item.def.meta);
  return list.length ? list.filter((item) => item.status === 'unlocked').length / list.length : 0;
}

const philosophical: Array<[string, string, string, string, Category[], string]> = [
  ['socrates', 'Copa de Sócrates', 'Sócrates', 'Gnosis', ['sabiduria'], 'Conoce tus datos: gráficas, peso y revisiones.'],
  ['platon', 'Copa de Platón', 'Platón', 'Kallipolis', ['nutricion'], 'Constancia en el registro de tu alimentación.'],
  ['aristoteles', 'Copa de Aristóteles', 'Aristóteles', 'Areté', ['fuerza', 'iron'], 'Fuerza y superación de marcas.'],
  ['estoicos', 'Copa de los Estoicos', 'Zenón', 'Enkrateia', ['disciplina'], 'Disciplina y constancia semanal.'],
];

const muscular: Array<[string, string, string, LeagueMuscle[]]> = [
  ['ares', 'Copa de Ares', 'Pecho', ['Pecho']],
  ['atlas', 'Copa de Atlas', 'Espalda', ['Espalda']],
  ['aquiles', 'Copa de Aquiles', 'Piernas', ['Piernas']],
  ['atenea', 'Copa de Atenea', 'Hombros', ['Hombros']],
  ['hefesto', 'Copa de Hefesto', 'Brazos', ['Bíceps', 'Tríceps']],
  ['prometeo', 'Copa de Prometeo', 'Abdomen', ['Abdomen']],
];

export function computeCups(achievements: AchievementState[], muscles: MuscleScore[]): Cup[] {
  const cups: Cup[] = philosophical.map(([id, name, philosopher, concept, categories, hint]) => {
    const value = fraction(achievements, categories);
    return { id, name, philosopher, concept, value, level: cupLevel(value), kind: 'filosofica', hint };
  });
  muscular.forEach(([id, name, label, list]) => {
    const scores = muscles.filter((m) => list.includes(m.muscle));
    const value = scores.reduce((sum, m) => sum + m.score, 0) / scores.length / 10000;
    cups.push({ id, name, philosopher: label, concept: divisionFor(value * 10000).name, value, level: cupLevel(value), kind: 'muscular', hint: `Sube tu Muscle Score de ${label}.` });
  });
  const overall = muscles.reduce((sum, m) => sum + m.score, 0) / muscles.length / 10000;
  const all = achievements.filter((item) => !item.def.meta);
  const unlocked = all.length ? all.filter((item) => item.status === 'unlocked').length / all.length : 0;
  const olimpo = (overall + unlocked) / 2;
  cups.push({ id: 'olimpo', name: 'Copa del Olimpo', philosopher: 'Zeus', concept: 'Apex', value: olimpo, level: cupLevel(olimpo), kind: 'general', hint: 'Equilibrio entre todos tus músculos y tus logros.' });
  return cups;
}
