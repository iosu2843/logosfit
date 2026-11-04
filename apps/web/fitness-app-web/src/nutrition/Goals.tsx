import { useEffect, useMemo, useState } from 'react';
import { ProgressBar } from './charts';
import { round0, toDateKey } from './calc';
import type { NutritionCtx } from './ctx';
import {
  computeGoals, defaultFlags, goalModes, goalToMode, modeToGoal, reviewGoals, weeklyGoalTemplates, weeklyProgress, type GoalsResult,
} from './nutritionGoalsEngine';
import { newId } from './store';
import { summarizeTraining } from './training';
import type { GoalMode, GoalPrefs, GoalsState, SafetyFlags, Targets, WeeklyGoal } from './types';
import { mealTypes } from './types';
import { weekStartOf } from '../workoutLog';

const flagLabels: Array<[keyof SafetyFlags, string]> = [
  ['eatingDisorder', 'Antecedentes de trastorno de la conducta alimentaria'],
  ['pregnancy', 'Embarazo o lactancia'],
  ['condition', 'Condición médica relevante (diabetes, renal, etc.)'],
  ['medication', 'Tomo medicación que afecta a la alimentación'],
];

const missingHelp = 'Completa estos datos en tu perfil (menú Perfil) para calcular tus metas: ';

export default function Goals({ ctx }: { ctx: NutritionCtx }) {
  const { ai, today } = ctx;
  const goals = ai.goals;
  const prefs = goals.prefs;
  const mode: GoalMode = goals.mode ?? goalToMode(ctx.goal);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const training = useMemo(() => summarizeTraining(ctx.plan, ctx.metrics), [ctx.plan, ctx.metrics]);
  const weekStart = toDateKey(weekStartOf(new Date(`${today}T12:00:00`)));

  const updateGoals = (change: (current: GoalsState) => GoalsState) => ctx.updateAI((current) => ({ ...current, goals: change(current.goals) }));
  const updatePrefs = (patch: Partial<GoalPrefs>) => updateGoals((current) => ({ ...current, prefs: { ...current.prefs, ...patch } }));

  const mealsPerDay = mealTypes.filter((meal) => (ctx.ai.mealSplit[meal.id] ?? 0) > 0).length;
  const result: GoalsResult = useMemo(
    () => computeGoals({
      mode, sex: ctx.profile.sex, age: ctx.profile.age, weightKg: ctx.profile.weightKg, heightCm: ctx.profile.heightCm,
      activityLevel: ctx.profile.activityLevel, experience: prefs.experience || ctx.profile.experience, sessionsPerWeek: training.sessionsPerWeek,
      flags: prefs.flags, mealsPerDay,
    }),
    [mode, ctx.profile, prefs.experience, prefs.flags, training.sessionsPerWeek, mealsPerDay],
  );

  // Cada semana se generan metas nuevas; las del usuario se conservan.
  useEffect(() => {
    if (goals.weekStart === weekStart && goals.weekly.length > 0) return;
    updateGoals((current) => {
      const custom = current.weekly.filter((goal) => goal.id.startsWith('custom-')).map((goal) => ({ ...goal, manualProgress: 0, manualDone: false }));
      return { ...current, weekStart, weekly: [...weeklyGoalTemplates({ mode, sessionsPerWeek: training.sessionsPerWeek, hasFiber: true }), ...custom] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const blocked = result.status === 'blocked';
  const lastChange = [...goals.reviews].reverse().find((item) => item.action === 'apply')?.date;
  const review = useMemo(
    () => reviewGoals({ mode: result.mode, today, targets: ctx.targets, bodyWeight: ctx.bodyWeight, entriesByDay: ctx.entriesByDay, lastChangeDate: lastChange, blocked }),
    [result.mode, today, ctx.targets, ctx.bodyWeight, ctx.entriesByDay, lastChange, blocked],
  );

  const applyTargets = (targets: Targets, nextMode: GoalMode, title: string, water?: number) => {
    const from = ctx.targets;
    ctx.setTargets(targets);
    if (water) ctx.setWaterGoal(water);
    ctx.updateAI((current) => ({
      ...current,
      goal: modeToGoal[nextMode],
      adjustments: [...current.adjustments, { date: today, summary: title, from, to: targets }],
      goals: { ...current.goals, mode: nextMode, reviews: [...current.goals.reviews, { date: today, title, action: 'apply', from, to: targets }] },
    }));
    setConfirming(null);
  };

  const selectMode = (next: GoalMode) => updateGoals((current) => ({ ...current, mode: next }));

  const weekData = { weekStart, today, entriesByDay: ctx.entriesByDay, targets: ctx.targets, fiberGrams: result.fiberGrams || 25, waterGoalMl: ctx.waterGoalMl, trainedDates: ctx.trainedDates };
  const patchGoal = (id: string, patch: Partial<WeeklyGoal>) => updateGoals((current) => ({ ...current, weekly: current.weekly.map((goal) => (goal.id === id ? { ...goal, ...patch } : goal)) }));
  const removeGoal = (id: string) => updateGoals((current) => ({ ...current, weekly: current.weekly.filter((goal) => goal.id !== id) }));
  const addCustom = () => {
    const name = customName.trim().slice(0, 80);
    if (!name) return;
    const goal: WeeklyGoal = { id: newId('custom'), name, description: 'Meta personal.', reason: 'La has definido tú.', target: 5, manualProgress: 0, manualDone: false };
    updateGoals((current) => ({ ...current, weekly: [...current.weekly, goal] }));
    setCustomName('');
  };
  const resetWeek = () => updateGoals((current) => ({ ...current, weekStart: null, weekly: [] }));

  const current = ctx.targets;
  const differs = result.status === 'ok' && (Math.abs(result.targets.calories - current.calories) >= 10 || result.targets.protein !== current.protein);
  const modeLabel = goalModes.find((item) => item.id === result.mode)?.label ?? '';

  return (
    <div className="nai-stack">
      <section className="nai-card">
        <header className="nai-card-head"><h3>Tu objetivo</h3><span className="nai-chip">{modeLabel}</span></header>
        <div className="nai-chips">
          {goalModes.map((item) => (
            <button key={item.id} type="button" className={`nai-chip nai-chip-btn${mode === item.id ? ' active' : ''}`} onClick={() => selectMode(item.id)} title={item.hint}>{item.label}</button>
          ))}
        </div>
        <p className="nai-muted">{goalModes.find((item) => item.id === mode)?.hint}</p>
        {result.mode !== mode && <p className="nai-muted">Por seguridad se aplica «{modeLabel}» en lugar del objetivo elegido.</p>}
      </section>

      <section className="nai-card">
        <header className="nai-card-head"><h3>Datos y preferencias</h3></header>
        <div className="nai-form">
          <label>Experiencia
            <select className="nai-input" value={prefs.experience || ctx.profile.experience} onChange={(event) => updatePrefs({ experience: event.target.value })}>
              <option value="">Sin indicar</option><option>Principiante</option><option>Intermedio</option><option>Avanzado</option>
            </select>
          </label>
          <label>Restricciones alimentarias
            <input className="nai-input" maxLength={200} value={prefs.restrictions} placeholder="Vegetariano, sin lactosa…" onChange={(event) => updatePrefs({ restrictions: event.target.value })} />
          </label>
          <label>Alergias
            <input className="nai-input" maxLength={200} value={prefs.allergies} placeholder="Frutos secos, marisco…" onChange={(event) => updatePrefs({ allergies: event.target.value })} />
          </label>
          <label>Horario de comidas
            <input className="nai-input" maxLength={200} value={prefs.mealTimes} placeholder="8:00, 14:00, 21:00…" onChange={(event) => updatePrefs({ mealTimes: event.target.value })} />
          </label>
        </div>
        <h4>Seguridad</h4>
        {flagLabels.map(([key, label]) => (
          <label key={key} className="nai-inline">
            <input type="checkbox" checked={prefs.flags[key]} onChange={(event) => updatePrefs({ flags: { ...defaultFlags(), ...prefs.flags, [key]: event.target.checked } })} />
            {label}
          </label>
        ))}
        <p className="nai-muted">Estos datos solo se usan para limitar las propuestas y se guardan en tu cuenta.</p>
      </section>

      {result.warnings.map((warning) => <p key={warning} className="nai-card nai-rec-warning">⚠️ {warning}</p>)}
      {result.status === 'missing-data' && <p className="nai-card nai-rec-warning">{missingHelp}{result.missing.join(', ')}.</p>}

      {result.status === 'ok' && (
        <>
          <section className="nai-card">
            <header className="nai-card-head"><h3>Metas propuestas</h3><span className="nai-chip">{result.calorieAdjustmentPercent >= 0 ? '+' : ''}{result.calorieAdjustmentPercent} % sobre mantenimiento</span></header>
            <dl className="nai-facts">
              <div><dt>Calorías</dt><dd>{result.targets.calories} kcal</dd></div>
              <div><dt>Proteína</dt><dd>{result.targets.protein} g · {result.proteinPerKg} g/kg · {result.proteinPercent} %</dd></div>
              <div><dt>Carbohidratos</dt><dd>{result.targets.carbohydrates} g · {result.carbPercent} %</dd></div>
              <div><dt>Grasas</dt><dd>{result.targets.fat} g · {result.fatPercent} %</dd></div>
              <div><dt>Fibra</dt><dd>≥ {result.fiberGrams} g</dd></div>
              <div><dt>Agua (orientativa)</dt><dd>{(result.waterMl / 1000).toFixed(2)} L</dd></div>
              <div><dt>Frutas y verduras</dt><dd>≥ 400 g/día</dd></div>
              <div><dt>Proteína por comida</dt><dd>~{result.proteinPerMeal} g ({mealsPerDay || 4} comidas)</dd></div>
            </dl>
            <ProgressBar value={result.targets.protein * 4} max={result.targets.calories} label="Proteína (% energía)" unit="kcal" />
            <ProgressBar value={result.targets.carbohydrates * 4} max={result.targets.calories} label="Carbohidratos (% energía)" unit="kcal" color="#ffb454" />
            <ProgressBar value={result.targets.fat * 9} max={result.targets.calories} label="Grasas (% energía)" unit="kcal" color="#e0e0e0" />
            <div className="nai-grid-2">
              <div className="nai-proposal"><strong>Día de entrenamiento</strong><span>{result.trainingDay.calories} kcal · P {result.trainingDay.protein} · C {result.trainingDay.carbohydrates} · G {result.trainingDay.fat}</span></div>
              <div className="nai-proposal"><strong>Día de descanso</strong><span>{result.restDay.calories} kcal · P {result.restDay.protein} · C {result.restDay.carbohydrates} · G {result.restDay.fat}</span></div>
            </div>
            <p className="nai-muted">Tus metas actuales: {round0(current.calories)} kcal · P {round0(current.protein)} g · C {round0(current.carbohydrates)} g · G {round0(current.fat)} g. Ningún cambio se aplica sin tu confirmación.</p>
            {differs ? (
              confirming === 'apply' ? (
                <div className="nai-actions">
                  <span>¿Aplicar estas metas?</span>
                  <button type="button" className="nai-btn nai-primary" onClick={() => applyTargets(result.targets, result.mode, `Metas ${modeLabel}`, result.waterMl)}>Sí, aplicar</button>
                  <button type="button" className="nai-btn" onClick={() => setConfirming(null)}>Cancelar</button>
                </div>
              ) : <button type="button" className="nai-btn nai-primary" onClick={() => setConfirming('apply')}>Aplicar estas metas…</button>
            ) : <p className="nai-muted">Tus metas ya coinciden con esta propuesta.</p>}
            <details className="nai-details">
              <summary>¿Por qué tengo estas metas?</summary>
              <ul>{result.rationale.map((line) => <li key={line}>{line}</li>)}</ul>
              <p className="nai-muted">Fórmulas generales y rangos habituales; la respuesta individual varía.</p>
            </details>
          </section>

          <section className="nai-card">
            <header className="nai-card-head"><h3>Revisión periódica</h3><span className="nai-chip">{review.action === 'keep' ? 'Mantener' : review.action === 'wait' ? 'Esperar' : 'Ajuste propuesto'}</span></header>
            <strong>{review.title}</strong>
            <p>{review.detail}</p>
            {review.rationale.length > 0 && <details className="nai-details"><summary>¿Por qué?</summary><ul>{review.rationale.map((line) => <li key={line}>{line}</li>)}</ul></details>}
            {review.proposal && (
              <div className="nai-proposal">
                <p><strong>Propuesta:</strong> {round0(ctx.targets.calories)} → <strong>{round0(review.proposal.calories)} kcal</strong> · C {round0(review.proposal.carbohydrates)} g (proteína y grasas sin cambios)</p>
                {confirming === review.id ? (
                  <div className="nai-actions">
                    <span>¿Confirmas el cambio?</span>
                    <button type="button" className="nai-btn nai-primary" onClick={() => applyTargets(review.proposal as Targets, result.mode, review.title)}>Sí, aplicar</button>
                    <button type="button" className="nai-btn" onClick={() => setConfirming(null)}>Cancelar</button>
                  </div>
                ) : (
                  <div className="nai-actions">
                    <button type="button" className="nai-btn nai-primary" onClick={() => setConfirming(review.id)}>Aplicar propuesta…</button>
                    <button type="button" className="nai-btn" onClick={() => updateGoals((state) => ({ ...state, reviews: [...state.reviews, { date: today, title: review.title, action: 'dismiss' }] }))}>Mantener como está</button>
                  </div>
                )}
              </div>
            )}
            <p className="nai-muted">Se basa en tendencias de varias semanas y no cambia nada por un solo día o pesaje.</p>
          </section>
        </>
      )}

      <section className="nai-card">
        <header className="nai-card-head"><h3>Metas de la semana</h3><button type="button" className="nai-link" onClick={resetWeek}>Regenerar</button></header>
        <ul className="nai-list">
          {goals.weekly.map((goal) => {
            const progress = weeklyProgress(goal, weekData);
            return (
              <li key={goal.id}>
                <div>
                  <strong>{progress.done ? '✅ ' : ''}{goal.name}</strong>
                  <small>{goal.description}</small>
                  <small>Motivo: {goal.reason}</small>
                  <ProgressBar value={Math.min(progress.value, progress.target)} max={progress.target} label={progress.state === 'done' ? 'Completada' : progress.state === 'progress' ? 'En progreso' : 'Pendiente'} unit={progress.auto ? 'auto' : 'manual'} />
                </div>
                {!progress.auto && (
                  <div className="nai-actions">
                    <button type="button" className="nai-btn" aria-label="Restar" onClick={() => patchGoal(goal.id, { manualProgress: Math.max(0, goal.manualProgress - 1), manualDone: false })}>−</button>
                    <button type="button" className="nai-btn" aria-label="Sumar" onClick={() => patchGoal(goal.id, { manualProgress: Math.min(goal.target, goal.manualProgress + 1) })}>+</button>
                  </div>
                )}
                <button type="button" className="nai-link" aria-label={`Quitar ${goal.name}`} onClick={() => removeGoal(goal.id)}>✕</button>
              </li>
            );
          })}
        </ul>
        <div className="nai-row">
          <input className="nai-input" maxLength={80} value={customName} placeholder="Añadir meta propia" onChange={(event) => setCustomName(event.target.value)} />
          <button type="button" className="nai-btn" onClick={addCustom} disabled={!customName.trim()}>Añadir</button>
        </div>
      </section>

      {goals.reviews.length > 0 && (
        <section className="nai-card">
          <header className="nai-card-head"><h3>Historial de revisiones</h3></header>
          <ul className="nai-list">
            {[...goals.reviews].reverse().slice(0, 10).map((item, index) => (
              <li key={`${item.date}-${index}`}><div><strong>{item.date} · {item.title}</strong><small>{item.action === 'apply' && item.to ? `Aplicado: ${round0(item.from?.calories ?? 0)} → ${round0(item.to.calories)} kcal` : 'Sin cambios'}</small></div></li>
            ))}
          </ul>
        </section>
      )}

      <p className="nai-disclaimer">Información orientativa basada en fórmulas generales. No sustituye el consejo de un médico o dietista-nutricionista, especialmente si eres menor de edad, estás embarazada o tienes una condición de salud.</p>
    </div>
  );
}
