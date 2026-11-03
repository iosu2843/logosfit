import { dayTotals, entriesByMeal, round0, splitByMeals } from './calc';
import { Ring, ProgressBar } from './charts';
import type { NutritionCtx } from './ctx';
import { newId } from './store';
import { trainingInfoForDate } from './training';
import { goalLabels } from './calc';
import { mealTypes } from './types';

export default function Dashboard({ ctx, goTo }: { ctx: NutritionCtx; goTo: (tab: string) => void }) {
  const { today, entriesByDay, targets } = ctx;
  const totals = dayTotals(entriesByDay[today]);
  const eaten = totals.macros;
  const remaining = targets.calories - eaten.calories;
  const grouped = entriesByMeal(entriesByDay[today]);
  const perMeal = splitByMeals(targets, ctx.ai.mealSplit);
  const training = trainingInfoForDate(ctx.plan, today);

  const addWater = (ml: number) =>
    ctx.addEntries(today, [{ id: newId('water'), timestamp: new Date().toISOString(), kind: 'water', amount: ml }]);

  return (
    <div className="nai-grid-2">
      {ctx.provisional && (
        <div className="nai-notice nai-span">
          Objetivos provisionales ({round0(targets.calories)} kcal). Complétalos en <button type="button" className="nai-link" onClick={() => goTo('planner')}>Planificador</button> para que las recomendaciones sean fiables.
        </div>
      )}

      <section className="nai-card">
        <header className="nai-card-head">
          <h3>Calorías de hoy</h3>
          <span className="nai-chip">{goalLabels[ctx.goal]}</span>
        </header>
        <div className="nai-kcal">
          <Ring value={eaten.calories} max={targets.calories} label="Consumidas" unit="kcal" size={150} />
          <dl className="nai-kcal-list">
            <div><dt>Objetivo</dt><dd>{round0(targets.calories)} kcal</dd></div>
            <div><dt>Consumidas</dt><dd>{round0(eaten.calories)} kcal</dd></div>
            <div className={remaining < 0 ? 'nai-over' : ''}><dt>{remaining < 0 ? 'Excedido' : 'Restantes'}</dt><dd>{round0(Math.abs(remaining))} kcal</dd></div>
          </dl>
        </div>
      </section>

      <section className="nai-card">
        <header className="nai-card-head"><h3>Macronutrientes</h3></header>
        <div className="nai-rings">
          <Ring value={eaten.protein} max={targets.protein} label="Proteínas" unit="g" color="#ff7a00" />
          <Ring value={eaten.carbohydrates} max={targets.carbohydrates} label="Carbohidratos" unit="g" color="#ffb454" />
          <Ring value={eaten.fat} max={targets.fat} label="Grasas" unit="g" color="#e0e0e0" />
        </div>
        {(eaten.fiber ?? 0) > 0 && <p className="nai-muted">Fibra registrada: {round0(eaten.fiber ?? 0)} g</p>}
      </section>

      <section className="nai-card">
        <header className="nai-card-head"><h3>Agua</h3></header>
        <ProgressBar value={totals.waterMl} max={ctx.waterGoalMl} label="Consumo de hoy" unit="ml" color="#4aa8ff" />
        <div className="nai-actions">
          {[250, 500].map((ml) => <button key={ml} type="button" className="nai-btn" onClick={() => addWater(ml)}>+{ml} ml</button>)}
        </div>
      </section>

      <section className="nai-card">
        <header className="nai-card-head"><h3>Hoy en tu entrenamiento</h3></header>
        <p>
          {training.isTraining ? <><strong>Día de entrenamiento</strong>{training.name ? ` · ${training.name}` : ''} ({training.exerciseCount} ejercicios)</> : <strong>Día de descanso</strong>}
        </p>
        <p className="nai-muted">
          {training.isTraining
            ? 'Reparte la proteína en varias tomas y procura una comida con carbohidratos y proteína antes o después de entrenar.'
            : 'La recuperación continúa: mantén la proteína y la hidratación habituales.'}
        </p>
        <button type="button" className="nai-link" onClick={() => goTo('insights')}>Ver recomendaciones →</button>
      </section>

      <section className="nai-card nai-span">
        <header className="nai-card-head"><h3>Distribución de las comidas</h3><button type="button" className="nai-link" onClick={() => goTo('diary')}>Abrir diario</button></header>
        <div className="nai-meal-dist">
          {mealTypes.map((meal) => {
            const kcal = grouped[meal.id].reduce((sum, entry) => sum + (entry.macros?.calories ?? 0), 0);
            const goal = perMeal[meal.id].calories;
            return (
              <div key={meal.id} className="nai-meal-col">
                <div className="nai-meal-bar"><span style={{ height: `${goal > 0 ? Math.min(100, (kcal / goal) * 100) : 0}%` }} /></div>
                <strong>{round0(kcal)}</strong>
                <small>/ {goal} kcal</small>
                <span>{meal.label}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
