import { useState } from 'react';
import { round0, withCarbsForCalories } from './calc';
import type { NutritionCtx } from './ctx';
import { mealTypes, type MealType, type Targets } from './types';

const parse = (text: string) => {
  const value = Number(text.replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) && value >= 0 ? value : null;
};

/** Edición manual de metas, reparto por comidas y agua. Sustituye al antiguo editor del Planificador. */
export default function ManualTargets({ ctx }: { ctx: NutritionCtx }) {
  const [draft, setDraft] = useState({ calories: String(ctx.targets.calories), protein: String(ctx.targets.protein), fat: String(ctx.targets.fat), water: String(ctx.waterGoalMl) });
  const [split, setSplit] = useState<Record<MealType, string>>(() => Object.fromEntries(mealTypes.map((meal) => [meal.id, String(ctx.ai.mealSplit[meal.id])])) as Record<MealType, string>);
  const [message, setMessage] = useState('');

  const calories = parse(draft.calories);
  const protein = parse(draft.protein);
  const fat = parse(draft.fat);
  const water = parse(draft.water);
  const valid = calories !== null && protein !== null && fat !== null && calories >= 800 && calories <= 8000 && protein <= 500 && fat <= 400;
  const preview: Targets | null = valid ? withCarbsForCalories({ calories, protein, fat, carbohydrates: 0 }) : null;
  const splitTotal = mealTypes.reduce((sum, meal) => sum + (parse(split[meal.id]) ?? 0), 0);

  const save = () => {
    if (!preview) return setMessage('Revisa los valores: calorías entre 800 y 8000.');
    if (Math.abs(splitTotal - 100) > 1) return setMessage('El reparto de comidas debe sumar 100 %.');
    if (water === null || water < 250 || water > 10000) return setMessage('El agua debe estar entre 250 y 10000 ml.');
    ctx.setTargets(preview);
    ctx.setWaterGoal(water);
    ctx.updateAI((current) => ({ ...current, mealSplit: Object.fromEntries(mealTypes.map((meal) => [meal.id, parse(split[meal.id]) ?? 0])) as Record<MealType, number> }));
    setMessage(preview.carbohydrates === 0 ? 'Guardado, pero con esos valores no quedan calorías para los carbohidratos.' : 'Metas guardadas.');
  };

  return (
    <section className="nai-card">
      <header className="nai-card-head"><h3>Ajuste manual</h3>{ctx.provisional && <span className="nai-chip">Provisional</span>}</header>
      <p className="nai-muted">Si prefieres tus propios valores, edítalos aquí. Los carbohidratos se calculan solos.</p>
      <div className="nai-form">
        <label>Calorías (kcal)<input className="nai-input" inputMode="decimal" value={draft.calories} onChange={(event) => setDraft({ ...draft, calories: event.target.value })} /></label>
        <label>Proteínas (g)<input className="nai-input" inputMode="decimal" value={draft.protein} onChange={(event) => setDraft({ ...draft, protein: event.target.value })} /></label>
        <label>Grasas (g)<input className="nai-input" inputMode="decimal" value={draft.fat} onChange={(event) => setDraft({ ...draft, fat: event.target.value })} /></label>
        <label>Carbohidratos (g) · automático<input className="nai-input" readOnly value={preview ? preview.carbohydrates : '—'} /></label>
        <label>Agua (ml)<input className="nai-input" inputMode="decimal" value={draft.water} onChange={(event) => setDraft({ ...draft, water: event.target.value })} /></label>
      </div>
      <h4>Reparto de calorías por comida ({round0(splitTotal)} %)</h4>
      <div className="nai-form">
        {mealTypes.map((meal) => (
          <label key={meal.id}>{meal.label} (%)
            <input className="nai-input" inputMode="decimal" value={split[meal.id]} onChange={(event) => setSplit({ ...split, [meal.id]: event.target.value })} />
            {preview && <small className="nai-muted">{round0(preview.calories * ((parse(split[meal.id]) ?? 0) / 100))} kcal</small>}
          </label>
        ))}
      </div>
      <div className="nai-actions"><button type="button" className="nai-btn nai-primary" onClick={save}>Guardar metas</button></div>
      {message && <p className="nai-muted" role="status">{message}</p>}
    </section>
  );
}
