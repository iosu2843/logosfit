import { bestMark, customDef, ironMilestones, ironTier, ironXp, isValidCustom, metricUnit, type MilestoneDef } from './milestones';
import { categoryInfo, type Achievement, type Category, type CustomMilestone, type Metrics, type Tier } from './types';

const xpByTier: Record<Tier, number> = { bronce: 50, plata: 100, oro: 200, platino: 400, legendario: 800 };
const diffByTier: Record<Tier, 1 | 2 | 3 | 4 | 5> = { bronce: 1, plata: 2, oro: 3, platino: 4, legendario: 5 };

const make = (
  id: string,
  name: string,
  philosopher: string,
  description: string,
  category: Category,
  tier: Tier,
  target: number,
  value: (metrics: Metrics) => number,
  extra: Partial<Achievement> = {},
): Achievement => ({
  id,
  name,
  philosopher,
  description,
  category,
  tier,
  xp: xpByTier[tier],
  difficulty: diffByTier[tier],
  progress: (metrics) => ({ current: Math.min(value(metrics), target), target }),
  ...extra,
});

const flag = (test: (metrics: Metrics) => boolean) => (metrics: Metrics) => (test(metrics) ? 1 : 0);

const general: Achievement[] = [
  // Fuerza (Areté)
  make('fuerza-primera-serie', 'El primer paso', 'Lao Tse', 'Registra tu primera sesión con series completas.', 'fuerza', 'bronce', 1, (m) => m.setSessions),
  make('fuerza-10-prs', 'Areté en movimiento', 'Aristóteles', 'Supera tu marca en 10 ejercicios distintos.', 'fuerza', 'plata', 10, (m) => m.prExercises),
  make('fuerza-25-prs', 'Superación constante', 'Heráclito', 'Supera tu marca en 25 ejercicios distintos.', 'fuerza', 'oro', 25, (m) => m.prExercises),
  make('fuerza-volumen-5t', 'Carga de Sísifo', 'Camus', 'Acumula 5.000 kg de volumen total.', 'fuerza', 'bronce', 5000, (m) => m.totalVolume),
  make('fuerza-volumen-50t', 'El peso de Atlas', 'Hesíodo', 'Acumula 50.000 kg de volumen total.', 'fuerza', 'plata', 50000, (m) => m.totalVolume),
  make('fuerza-volumen-250t', 'Los doce trabajos', 'Heracles', 'Acumula 250.000 kg de volumen total.', 'fuerza', 'oro', 250000, (m) => m.totalVolume),
  make('fuerza-volumen-1000t', 'Titán del hierro', 'Hesíodo', 'Acumula 1.000.000 kg de volumen total.', 'fuerza', 'legendario', 1000000, (m) => m.totalVolume),
  make('fuerza-sesion-5t', 'Jornada heroica', 'Homero', 'Alcanza 5.000 kg de volumen en una sola sesión.', 'fuerza', 'plata', 5000, (m) => m.maxSessionVolume),
  make('fuerza-progresion', 'La virtud del hábito', 'Aristóteles', 'Mejora un 10 % tu mejor marca estimada en 3 ejercicios (con al menos 3 sesiones).', 'fuerza', 'oro', 3, (m) => m.progressiveExercises),
  // Disciplina (Estoicismo)
  make('disc-1', 'Comenzar es la mitad', 'Platón', 'Completa tu primer entrenamiento.', 'disciplina', 'bronce', 1, (m) => m.sessions),
  make('disc-10', 'Hábito naciente', 'Aristóteles', 'Completa 10 entrenamientos.', 'disciplina', 'bronce', 10, (m) => m.sessions),
  make('disc-50', 'Virtud cultivada', 'Aristóteles', 'Completa 50 entrenamientos.', 'disciplina', 'plata', 50, (m) => m.sessions),
  make('disc-100', 'La Stoa', 'Zenón', 'Completa 100 entrenamientos.', 'disciplina', 'oro', 100, (m) => m.sessions),
  make('disc-250', 'Constancia de Epicteto', 'Epicteto', 'Completa 250 entrenamientos.', 'disciplina', 'platino', 250, (m) => m.sessions),
  make('disc-500', 'Voluntad inquebrantable', 'Marco Aurelio', 'Completa 500 entrenamientos.', 'disciplina', 'legendario', 500, (m) => m.sessions),
  make('disc-semana-2', 'Dos semanas de orden', 'Séneca', 'Cumple todo lo planificado durante 2 semanas seguidas.', 'disciplina', 'bronce', 2, (m) => m.bestAdherenceStreak),
  make('disc-semana-4', 'Un mes de constancia', 'Marco Aurelio', 'Cumple todo lo planificado durante 4 semanas seguidas.', 'disciplina', 'plata', 4, (m) => m.bestAdherenceStreak),
  make('disc-semana-12', 'Trimestre estoico', 'Epicteto', 'Cumple todo lo planificado durante 12 semanas seguidas.', 'disciplina', 'oro', 12, (m) => m.bestAdherenceStreak),
  make('disc-semana-26', 'Medio año de Stoa', 'Zenón', 'Cumple todo lo planificado durante 26 semanas seguidas.', 'disciplina', 'platino', 26, (m) => m.bestAdherenceStreak),
  make('disc-semana-52', 'Un año de virtud', 'Sócrates', 'Cumple todo lo planificado durante 52 semanas seguidas.', 'disciplina', 'legendario', 52, (m) => m.bestAdherenceStreak),
  make('disc-52', 'Dominio del tiempo', 'Séneca', 'Entrena al menos una vez en 40 de las últimas 52 semanas.', 'disciplina', 'oro', 40, (m) => m.activeWeeksIn52),
  // Sabiduría (Sophia)
  make('sab-perfil', 'Conócete a ti mismo', 'Sócrates', 'Completa tu perfil.', 'sabiduria', 'bronce', 1, flag((m) => m.profileComplete), { undated: true }),
  make('sab-graficas', 'El observador', 'Aristóteles', 'Consulta tus gráficas de progreso en 5 días distintos.', 'sabiduria', 'bronce', 5, (m) => m.chartViews),
  make('sab-graficas-30', 'La mirada del sabio', 'Platón', 'Consulta tus gráficas de progreso en 30 días distintos.', 'sabiduria', 'plata', 30, (m) => m.chartViews),
  make('sab-peso', 'La balanza de Temis', 'Hesíodo', 'Registra tu peso corporal en 4 semanas consecutivas.', 'sabiduria', 'plata', 4, (m) => m.bodyWeightRun),
  make('sab-rutina', 'Arquitecto de la rutina', 'Pitágoras', 'Edita tu rutina en 3 días distintos.', 'sabiduria', 'bronce', 3, (m) => m.routineEdits),
  make('sab-informe', 'Escuchar al oráculo', 'Delfos', 'Consulta tu informe de logros 5 días.', 'sabiduria', 'bronce', 5, (m) => m.reportViews),
  make('sab-revision', 'Examen de conciencia', 'Sócrates', 'Haz tu revisión mensual (desde la pestaña Temporada).', 'sabiduria', 'plata', 1, (m) => m.reviews),
  make('sab-analista', 'El analista', 'Aristóteles', 'Haz 3 revisiones mensuales.', 'sabiduria', 'oro', 3, (m) => m.reviews),
  // Nutrición (Eudaimonía)
  make('nut-1', 'Primer bocado consciente', 'Epicuro', 'Registra tu primera comida.', 'nutricion', 'bronce', 1, (m) => m.mealsLogged),
  make('nut-7', 'Semana de atención', 'Epicuro', 'Registra tu alimentación en 7 días.', 'nutricion', 'bronce', 7, (m) => m.nutritionDays),
  make('nut-30', 'Mesa del filósofo', 'Epicuro', 'Registra tu alimentación en 30 días.', 'nutricion', 'plata', 30, (m) => m.nutritionDays),
  make('nut-100', 'Banquete de Platón', 'Platón', 'Registra tu alimentación en 100 días.', 'nutricion', 'oro', 100, (m) => m.nutritionDays),
  make('nut-proteina', 'Proteína al día', 'Aristóteles', 'Alcanza tu objetivo de proteína (90 %) 5 días en una semana.', 'nutricion', 'plata', 5, (m) => m.proteinWeek),
  make('nut-semanas-4', 'Equilibrio sostenido', 'Aristóteles', 'Registra tu alimentación al menos 5 días por semana durante 4 semanas.', 'nutricion', 'oro', 4, (m) => m.nutritionWeeks),
  make('nut-comidas', 'Orden en la mesa', 'Séneca', 'Haz 3 o más comidas registradas al día durante 5 días en 3 semanas.', 'nutricion', 'plata', 3, (m) => m.fullMealWeeks),
  make('nut-recetas', 'El recetario', 'Epicuro', 'Crea 3 recetas propias.', 'nutricion', 'bronce', 3, (m) => m.recipes, { undated: true }),
  make('nut-armonia', 'Armonía', 'Pitágoras', 'Combina 4 semanas consecutivas de entrenamiento completo y registro de nutrición.', 'nutricion', 'platino', 4, (m) => m.harmonyRun),
  // Resistencia
  make('res-cardio-1', 'Pasos de Filípides', 'Filípides', 'Registra tu primera sesión de cardio.', 'resistencia', 'bronce', 1, (m) => m.cardioSessions),
  make('res-cardio-10', 'Corredor de Maratón', 'Filípides', 'Registra 10 sesiones de cardio.', 'resistencia', 'plata', 10, (m) => m.cardioSessions),
  make('res-cardio-50', 'Resistencia espartana', 'Leónidas', 'Registra 50 sesiones de cardio.', 'resistencia', 'oro', 50, (m) => m.cardioSessions),
  make('res-cardio-semanas', 'Aliento constante', 'Heródoto', 'Haz cardio durante 4 semanas consecutivas.', 'resistencia', 'plata', 4, (m) => m.cardioWeekRun),
  // Exploración
  make('exp-ejercicios', 'Polímata', 'Aristóteles', 'Entrena 15 ejercicios distintos.', 'exploracion', 'plata', 15, (m) => Object.keys(m.setsByExercise).length),
  make('exp-dias', 'Todos los caminos', 'Heráclito', 'Entrena en 5 días distintos de la semana.', 'exploracion', 'plata', 5, (m) => m.distinctTrainingDays),
  make('exp-visitas', 'Peregrino del Liceo', 'Aristóteles', 'Usa la aplicación en 30 días distintos.', 'exploracion', 'bronce', 30, (m) => m.visits),
  make('exp-visitas-100', 'Habitante de Atenas', 'Pericles', 'Usa la aplicación en 100 días distintos.', 'exploracion', 'oro', 100, (m) => m.visits),
  // Secretos y estacionales
  make('sec-alba', 'Madrugador', 'Aurora', 'Termina un entrenamiento antes de las 7:00.', 'exploracion', 'plata', 1, flag((m) => m.dawnWorkout), { secret: true }),
  make('sec-semana-5', 'Cinco soles', 'Helios', 'Completa 5 entrenamientos en una misma semana.', 'exploracion', 'oro', 5, (m) => m.maxWeeklySessions, { secret: true }),
  make('sec-regreso', 'El eterno retorno', 'Nietzsche', 'Acumula 8 semanas con entrenamientos, aunque no sean seguidas.', 'exploracion', 'plata', 8, (m) => m.activeWeeks, { secret: true }),
];

function ironAchievements(defs: MilestoneDef[], minReps: (def: MilestoneDef) => number): Achievement[] {
  return defs.flatMap((def) =>
    def.steps.map((step, index) => {
      const tier = ironTier(index);
      const unit = metricUnit(def.metric, def.added);
      const name = def.names?.[index] ?? `${def.series} ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][index] ?? index + 1}`;
      const needs = def.metric === 'weight' ? ` (mínimo ${minReps(def)} repeticiones)` : '';
      return {
        id: `iron:${def.id}:${step}`,
        name,
        philosopher: def.exercise,
        description: `${def.exercise}: ${step} ${unit}${needs}.`,
        category: 'iron' as const,
        tier,
        xp: ironXp[tier],
        difficulty: diffByTier[tier],
        muscle: def.muscle,
        progress: (metrics: Metrics) => ({ current: Math.min(bestMark(metrics.setsByExercise[def.exercise], def.metric, minReps(def), def.added), step), target: step }),
      };
    }),
  );
}

function platinumAchievements(base: Achievement[]): Achievement[] {
  const categories: Category[] = ['fuerza', 'disciplina', 'sabiduria', 'nutricion'];
  const platinums = categories.map((category) => {
    const ids = base.filter((item) => item.category === category).map((item) => item.id);
    return {
      id: `platino-${category}`,
      name: `Platino de ${categoryInfo[category].label}`,
      philosopher: categoryInfo[category].greek,
      description: `Desbloquea todos los logros de ${categoryInfo[category].label}.`,
      category,
      tier: 'legendario' as const,
      xp: 1000,
      difficulty: 5 as const,
      platinumOf: category,
      meta: true,
      progress: (metrics: Metrics) => ({ current: metrics.unlockedOthers, target: ids.length }),
    } satisfies Achievement;
  });
  return platinums;
}

export const metaAchievements = (base: Achievement[]): Achievement[] => [
  make('meta-10', 'Coleccionista', 'Diógenes', 'Desbloquea 10 logros.', 'exploracion', 'plata', 10, (m) => m.unlockedOthers, { meta: true }),
  make('meta-50', 'Museo del Olimpo', 'Pausanias', 'Desbloquea 50 logros.', 'exploracion', 'platino', 50, (m) => m.unlockedOthers, { meta: true }),
  ...platinumAchievements(base),
];

export function buildAchievements(custom: CustomMilestone[] = [], minRepsFor: (def: MilestoneDef) => number = () => 3): Achievement[] {
  const customDefs = custom.filter(isValidCustom).map(customDef);
  const customMinReps = new Map(custom.map((item) => [`custom-${item.id}`, item.minReps]));
  const iron = ironAchievements(ironMilestones, minRepsFor);
  const own = ironAchievements(customDefs, (def) => customMinReps.get(def.id) ?? 3).map((item) => ({ ...item, category: 'propios' as const, xp: 0 }));
  const base = [...general, ...iron, ...own];
  return [...base, ...metaAchievements(base)];
}

