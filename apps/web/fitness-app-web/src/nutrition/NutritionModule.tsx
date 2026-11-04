import { useMemo, useState } from 'react';
import './nutrition.css';
import Dashboard from './Dashboard';
import Evolution from './Evolution';
import FoodLog from './FoodLog';
import Goals from './Goals';
import Insights from './Insights';
import Planner from './Planner';
import type { NutritionCtx, NutritionProfileInfo } from './ctx';
import { toDateKey } from './calc';
import { profileBmr, resolveTargets } from './targets';
import { useNutritionAI } from './store';
import type { MetricsLike, TrainingDayLike } from './training';
import type { NutritionEntry, ProgressPoint, Targets } from './types';

type TabId = 'summary' | 'goals' | 'diary' | 'planner' | 'insights' | 'evolution';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'summary', label: 'Resumen' },
  { id: 'goals', label: 'Metas' },
  { id: 'diary', label: 'Diario' },
  { id: 'planner', label: 'Planificador' },
  { id: 'insights', label: 'Recomendaciones' },
  { id: 'evolution', label: 'Evolución' },
];

export type NutritionModuleProps = {
  scopeId: string;
  profile: NutritionProfileInfo;
  entriesByDay: Record<string, NutritionEntry[]>;
  waterGoalMl: number;
  proteinGoalGrams: number;
  onAddEntries: (date: string, entries: NutritionEntry[]) => void;
  onRemoveEntry: (date: string, id: string) => void;
  onProteinGoal: (grams: number) => void;
  plan: Record<number, TrainingDayLike | undefined>;
  metrics: MetricsLike;
  bodyWeight: ProgressPoint[];
  exerciseLoads: Record<string, ProgressPoint[]>;
  trainedDates: string[];
  onWaterGoal: (ml: number) => void;
};

export default function NutritionModule(props: NutritionModuleProps) {
  const [tab, setTab] = useState<TabId>('summary');
  const [ai, updateAI] = useNutritionAI(props.scopeId);
  const today = toDateKey(new Date());
  const { profile } = props;

  const resolved = useMemo(() => resolveTargets(profile, ai.goal, ai.targets, props.proteinGoalGrams), [profile, ai.goal, ai.targets, props.proteinGoalGrams]);

  const ctx: NutritionCtx = {
    today,
    profile,
    entriesByDay: props.entriesByDay,
    waterGoalMl: props.waterGoalMl,
    ai,
    updateAI,
    goal: resolved.goal,
    targets: resolved.targets,
    provisional: resolved.provisional,
    bmr: profileBmr(profile),
    addEntries: props.onAddEntries,
    removeEntry: props.onRemoveEntry,
    setTargets: (targets: Targets) => {
      updateAI((current) => ({ ...current, targets }));
      props.onProteinGoal(Math.max(1, Math.round(targets.protein)));
    },
    plan: props.plan,
    metrics: props.metrics,
    bodyWeight: props.bodyWeight,
    exerciseLoads: props.exerciseLoads,
    trainedDates: props.trainedDates,
    setWaterGoal: props.onWaterGoal,
  };

  const goTo = (id: string) => setTab(id as TabId);

  return (
    <section className="nutrition-ai">
      <header className="topbar">
        <div>
          <p className="eyebrow">LOGOSFIT · {profile.name || 'Perfil local'}</p>
          <h1>Nutrition AI</h1>
        </div>
      </header>
      <nav className="nai-tabs" role="tablist" aria-label="Secciones de nutrición">
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </nav>
      <div className="nai-panel" role="tabpanel">
        {tab === 'summary' && <Dashboard ctx={ctx} goTo={goTo} />}
        {tab === 'goals' && <Goals ctx={ctx} />}
        {tab === 'diary' && <FoodLog ctx={ctx} />}
        {tab === 'planner' && <Planner ctx={ctx} />}
        {tab === 'insights' && <Insights ctx={ctx} />}
        {tab === 'evolution' && <Evolution ctx={ctx} />}
      </div>
    </section>
  );
}
