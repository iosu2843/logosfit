import { useMemo, useState } from 'react';
import { analyzeWeight } from './engine';
import { round0, round1 } from './calc';
import { BarChart, LineChart } from './charts';
import type { NutritionCtx } from './ctx';
import { adherence, buildBuckets, rangeLabels, weightSeries, type RangeId } from './stats';
import { performanceTrend } from './training';

export default function Evolution({ ctx }: { ctx: NutritionCtx }) {
  const [range, setRange] = useState<RangeId>('month');
  const { today, targets } = ctx;

  const buckets = useMemo(() => buildBuckets(ctx.entriesByDay, today, range), [ctx.entriesByDay, today, range]);
  const weights = useMemo(() => weightSeries(ctx.bodyWeight, today, range), [ctx.bodyWeight, today, range]);
  const adh = useMemo(() => adherence(ctx.entriesByDay, today, range, targets), [ctx.entriesByDay, today, range, targets]);
  const performance = useMemo(() => performanceTrend(ctx.exerciseLoads, today), [ctx.exerciseLoads, today]);
  const weightTrend = useMemo(() => analyzeWeight(ctx.bodyWeight, today), [ctx.bodyWeight, today]);
  const unitText = range === 'quarter' ? 'Media semanal' : 'Diario';
  const pct = (value: number) => (adh.loggedDays ? `${Math.round((value / adh.loggedDays) * 100)} %` : '—');

  return (
    <div className="nai-stack">
      <div className="nai-chips" role="tablist" aria-label="Periodo">
        {(Object.keys(rangeLabels) as RangeId[]).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={range === id} className={`nai-chip nai-chip-btn${range === id ? ' active' : ''}`} onClick={() => setRange(id)}>{rangeLabels[id]}</button>
        ))}
      </div>

      <section className="nai-card">
        <header className="nai-card-head"><h3>Peso corporal</h3></header>
        <LineChart
          series={[{ name: 'Peso', color: '#ff7a00', points: weights.map((point) => ({ label: point.date.slice(5).replace('-', '/'), value: point.value })) }]}
          unit="kg"
          emptyText="Registra tu peso en Progreso para ver su evolución."
        />
        {weightTrend.status === 'ok' && <p className="nai-muted">Tendencia (28 días): {weightTrend.weeklyChangeKg >= 0 ? '+' : ''}{round1(weightTrend.weeklyChangeKg)} kg/semana.</p>}
      </section>

      <section className="nai-card">
        <header className="nai-card-head"><h3>Calorías · {unitText.toLowerCase()}</h3></header>
        <BarChart points={buckets.map((bucket) => ({ label: bucket.label, value: bucket.calories }))} unit="kcal" target={targets.calories} emptyText="Aún no hay comidas registradas en este periodo." />
      </section>

      <section className="nai-card">
        <header className="nai-card-head"><h3>Proteínas · {unitText.toLowerCase()}</h3></header>
        <BarChart points={buckets.map((bucket) => ({ label: bucket.label, value: bucket.protein }))} unit="g" target={targets.protein} color="#ffb454" emptyText="Aún no hay datos de proteína en este periodo." />
      </section>

      <section className="nai-card">
        <header className="nai-card-head"><h3>Macronutrientes</h3></header>
        <LineChart
          series={[
            { name: 'Proteínas', color: '#ff7a00', points: buckets.map((bucket) => ({ label: bucket.label, value: bucket.protein })) },
            { name: 'Carbohidratos', color: '#ffd08a', points: buckets.map((bucket) => ({ label: bucket.label, value: bucket.carbohydrates })) },
            { name: 'Grasas', color: '#e0e0e0', points: buckets.map((bucket) => ({ label: bucket.label, value: bucket.fat })) },
          ]}
          unit="g"
          emptyText="Aún no hay datos de macronutrientes en este periodo."
        />
      </section>

      <section className="nai-card">
        <header className="nai-card-head"><h3>Cumplimiento de objetivos</h3></header>
        {adh.loggedDays === 0 ? <p className="nai-empty">Sin días registrados en este periodo.</p> : (
          <dl className="nai-facts">
            <div><dt>Días registrados</dt><dd>{adh.loggedDays}</dd></div>
            <div><dt>Calorías dentro de ±10 %</dt><dd>{adh.calorieDays} días ({pct(adh.calorieDays)})</dd></div>
            <div><dt>Proteína ≥ 90 % del objetivo</dt><dd>{adh.proteinDays} días ({pct(adh.proteinDays)})</dd></div>
          </dl>
        )}
      </section>

      <section className="nai-card">
        <header className="nai-card-head"><h3>Nutrición y rendimiento</h3></header>
        <dl className="nai-facts">
          <div><dt>Variación de cargas (8 sem)</dt><dd>{performance ? `${performance.averageChangePercent >= 0 ? '+' : ''}${round1(performance.averageChangePercent)} % en ${performance.exercisesTracked} ejercicios` : 'Sin datos suficientes'}</dd></div>
          <div><dt>Peso (tendencia)</dt><dd>{weightTrend.status === 'ok' ? `${weightTrend.weeklyChangeKg >= 0 ? '+' : ''}${round1(weightTrend.weeklyChangeKg)} kg/sem` : 'Sin datos suficientes'}</dd></div>
          <div><dt>Calorías medias del periodo</dt><dd>{buckets.some((bucket) => bucket.calories !== null) ? `${round0(buckets.filter((bucket) => bucket.calories !== null).reduce((sum, bucket) => sum + (bucket.calories ?? 0), 0) / buckets.filter((bucket) => bucket.calories !== null).length)} kcal` : '—'}</dd></div>
        </dl>
        <p className="nai-muted">Si el rendimiento se estanca con un peso estable y una ingesta ajustada a tu objetivo, el motor lo tendrá en cuenta en las recomendaciones. Una correlación no implica causalidad.</p>
      </section>
    </div>
  );
}
