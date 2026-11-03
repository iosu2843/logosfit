import { useMemo, useState } from 'react';
import { analyzeIntake, analyzeWeight, generateRecommendations } from './engine';
import { daysBetween, goalLabels, round0, round1 } from './calc';
import type { NutritionCtx } from './ctx';
import { performanceTrend, summarizeTraining, trainingInfoForDate } from './training';
import type { Recommendation } from './types';

const weekdayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
const kindLabel: Record<Recommendation['kind'], string> = { adjustment: 'Ajuste propuesto', warning: 'Aviso', tip: 'Consejo', info: 'Información' };
const DISMISS_DAYS = 14;

export default function Insights({ ctx }: { ctx: NutritionCtx }) {
  const { ai, today } = ctx;
  const [confirming, setConfirming] = useState<string | null>(null);

  const lastAdjustmentDate = ai.adjustments.length ? ai.adjustments[ai.adjustments.length - 1].date : undefined;
  const training = useMemo(() => summarizeTraining(ctx.plan, ctx.metrics), [ctx.plan, ctx.metrics]);
  const performance = useMemo(() => performanceTrend(ctx.exerciseLoads, today), [ctx.exerciseLoads, today]);
  const weight = useMemo(() => analyzeWeight(ctx.bodyWeight, today), [ctx.bodyWeight, today]);
  const intake = useMemo(() => analyzeIntake(ctx.entriesByDay, today), [ctx.entriesByDay, today]);

  const recommendations = useMemo(
    () =>
      generateRecommendations({
        today,
        profile: ctx.profile,
        goal: ctx.goal,
        targets: ctx.targets,
        bmr: ctx.bmr,
        bodyWeight: ctx.bodyWeight,
        entriesByDay: ctx.entriesByDay,
        training,
        todayTraining: trainingInfoForDate(ctx.plan, today),
        performance,
        waterGoalMl: ctx.waterGoalMl,
        lastAdjustmentDate,
      }),
    [ctx, today, training, performance, lastAdjustmentDate],
  );

  const visible = recommendations.filter((item) => {
    const dismissedOn = ai.dismissed[item.id];
    return !dismissedOn || daysBetween(dismissedOn, today) >= DISMISS_DAYS;
  });

  const apply = (item: Recommendation) => {
    if (!item.proposal) return;
    const from = ctx.targets;
    ctx.setTargets(item.proposal);
    ctx.updateAI((current) => ({ ...current, adjustments: [...current.adjustments, { date: today, summary: item.title, from, to: item.proposal ?? from }] }));
    setConfirming(null);
  };

  const dismiss = (id: string) => ctx.updateAI((current) => ({ ...current, dismissed: { ...current.dismissed, [id]: today } }));

  return (
    <div className="nai-stack">
      <section className="nai-card">
        <header className="nai-card-head"><h3>Resumen del análisis</h3><span className="nai-chip">{goalLabels[ctx.goal]}</span></header>
        <dl className="nai-facts">
          <div><dt>Peso (tendencia 28 días)</dt><dd>{weight.status === 'ok' ? `${weight.weeklyChangeKg >= 0 ? '+' : ''}${round1(weight.weeklyChangeKg)} kg/sem` : `Datos insuficientes (${weight.points} registros)`}</dd></div>
          <div><dt>Calorías medias (14 días)</dt><dd>{intake.loggedDays > 0 ? `${round0(intake.avgCalories)} kcal en ${intake.loggedDays} días` : 'Sin registros'}</dd></div>
          <div><dt>Proteína media</dt><dd>{intake.loggedDays > 0 ? `${round0(intake.avgProtein)} g` : '—'}</dd></div>
          <div><dt>Entrenamiento</dt><dd>{training.sessionsPerWeek} sesiones · {training.setsPerWeek} series/sem</dd></div>
          <div><dt>Rendimiento (8 sem)</dt><dd>{performance ? `${performance.averageChangePercent >= 0 ? '+' : ''}${round1(performance.averageChangePercent)} % en ${performance.exercisesTracked} ejercicios` : 'Sin datos suficientes'}</dd></div>
        </dl>
        <p className="nai-muted">Las recomendaciones se basan en tendencias de varias semanas, no en un único día. Ningún objetivo cambia sin tu confirmación.</p>
      </section>

      {visible.length === 0 && <p className="nai-empty">No hay recomendaciones pendientes. Registra comidas y tu peso con regularidad para obtener análisis.</p>}

      {visible.map((item) => (
        <section key={item.id} className={`nai-card nai-rec nai-rec-${item.kind}`}>
          <header className="nai-card-head"><h3>{item.title}</h3><span className="nai-chip">{kindLabel[item.kind]}</span></header>
          <p>{item.detail}</p>
          {item.rationale.length > 0 && (
            <details className="nai-details">
              <summary>¿Por qué?</summary>
              <ul>{item.rationale.map((line) => <li key={line}>{line}</li>)}</ul>
            </details>
          )}
          {item.proposal && (
            <div className="nai-proposal">
              <p>
                <strong>Propuesta:</strong> {round0(ctx.targets.calories)} → <strong>{round0(item.proposal.calories)} kcal</strong> · P {round0(item.proposal.protein)} g · C {round0(item.proposal.carbohydrates)} g · G {round0(item.proposal.fat)} g
              </p>
              {confirming === item.id ? (
                <div className="nai-actions">
                  <span>¿Confirmas cambiar tus objetivos?</span>
                  <button type="button" className="nai-btn nai-primary" onClick={() => apply(item)}>Sí, aplicar</button>
                  <button type="button" className="nai-btn" onClick={() => setConfirming(null)}>Cancelar</button>
                </div>
              ) : (
                <div className="nai-actions">
                  <button type="button" className="nai-btn nai-primary" onClick={() => setConfirming(item.id)}>Aplicar propuesta…</button>
                  <button type="button" className="nai-btn" onClick={() => dismiss(item.id)}>Descartar</button>
                </div>
              )}
            </div>
          )}
          {!item.proposal && item.kind !== 'info' && <button type="button" className="nai-link" onClick={() => dismiss(item.id)}>Ocultar 14 días</button>}
        </section>
      ))}

      <section className="nai-card">
        <header className="nai-card-head"><h3>Semana: entrenamiento y alimentación</h3></header>
        <ul className="nai-list">
          {weekdayOrder.map((index) => {
            const type = training.typeByWeekday[index];
            const trains = training.trainingWeekdays.includes(index);
            return (
              <li key={index}>
                <div>
                  <strong>{weekdayNames[index]}</strong>
                  <small>{trains ? `Entrenamiento${type ? ` · ${type}` : ''}: prioriza una comida con carbohidratos y proteína antes o después de la sesión.` : 'Descanso: mantén la proteína y la hidratación; no hace falta compensar comiendo menos.'}</small>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="nai-muted">Las necesidades dependen de tu energía total y tu evolución, no del grupo muscular que entrenes ese día.</p>
      </section>

      {ai.adjustments.length > 0 && (
        <section className="nai-card">
          <header className="nai-card-head"><h3>Historial de ajustes</h3></header>
          <ul className="nai-list">
            {[...ai.adjustments].reverse().map((item) => <li key={`${item.date}-${item.summary}`}><div><strong>{item.date}</strong><small>{item.summary}: {round0(item.from.calories)} → {round0(item.to.calories)} kcal</small></div></li>)}
          </ul>
        </section>
      )}

      <p className="nai-disclaimer">Información orientativa basada en fórmulas generales. No sustituye el consejo de un médico o dietista-nutricionista, especialmente si tienes una condición de salud, estás embarazada o eres menor de edad.</p>
    </div>
  );
}
