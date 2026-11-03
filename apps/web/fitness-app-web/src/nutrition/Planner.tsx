import { useMemo, useState } from 'react';
import { addMacros, emptyMacros, entriesByMeal, entryMacros, goalLabels, parseDateKey, recipePerServing, recipeTotals, round0, round1, scalePer100, splitByMeals, withCarbsForCalories } from './calc';
import type { NutritionCtx } from './ctx';
import { referenceFoods, searchFoods } from './foods';
import { emptyPlanDay, makeMealEntry, newId } from './store';
import { mealTypes, type Macros, type MealType, type NutritionGoal, type PlanDay, type PlannedItem, type Recipe, type RecipeIngredient, type Targets } from './types';
import { suggestTargetsFromProfile } from './targets';

const parse = (text: string) => {
  const value = Number(text.replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) && value >= 0 ? value : null;
};
const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
const macroText = (macros: Macros) => `${round0(macros.calories)} kcal · P ${round1(macros.protein)} · C ${round1(macros.carbohydrates)} · G ${round1(macros.fat)}`;

function TargetsEditor({ ctx }: { ctx: NutritionCtx }) {
  const [goal, setGoal] = useState<NutritionGoal>(ctx.goal);
  const [draft, setDraft] = useState({ calories: String(ctx.targets.calories), protein: String(ctx.targets.protein), fat: String(ctx.targets.fat) });
  const [split, setSplit] = useState<Record<MealType, string>>(() => Object.fromEntries(mealTypes.map((meal) => [meal.id, String(ctx.ai.mealSplit[meal.id])])) as Record<MealType, string>);
  const [message, setMessage] = useState('');

  const calories = parse(draft.calories);
  const protein = parse(draft.protein);
  const fat = parse(draft.fat);
  const valid = calories !== null && protein !== null && fat !== null && calories >= 800 && calories <= 8000 && protein <= 500 && fat <= 400;
  const preview: Targets | null = valid ? withCarbsForCalories({ calories, protein, fat, carbohydrates: 0 }) : null;
  const splitTotal = mealTypes.reduce((sum, meal) => sum + (parse(split[meal.id]) ?? 0), 0);

  const recalc = () => {
    const suggested = suggestTargetsFromProfile(ctx.profile, goal);
    if (!suggested) return setMessage('Completa peso, altura y edad en tu perfil para calcular una estimación.');
    setDraft({ calories: String(suggested.calories), protein: String(suggested.protein), fat: String(suggested.fat) });
    setMessage('Estimación basada en la fórmula de Mifflin-St Jeor y tu nivel de actividad. Es un punto de partida: ajústala según tu evolución.');
  };

  const save = () => {
    if (!preview) return setMessage('Revisa los valores: calorías entre 800 y 8000.');
    if (Math.abs(splitTotal - 100) > 1) return setMessage('El reparto de comidas debe sumar 100 %.');
    if (preview.carbohydrates === 0 && preview.calories > 0) setMessage('Atención: con esos valores no quedan calorías para los carbohidratos.');
    ctx.setTargets(preview);
    ctx.updateAI((current) => ({ ...current, goal, mealSplit: Object.fromEntries(mealTypes.map((meal) => [meal.id, parse(split[meal.id]) ?? 0])) as Record<MealType, number> }));
    setMessage('Objetivos guardados.');
  };

  return (
    <section className="nai-card">
      <header className="nai-card-head"><h3>Objetivos</h3>{ctx.provisional && <span className="nai-chip">Provisional</span>}</header>
      <div className="nai-chips" role="radiogroup" aria-label="Objetivo">
        {(Object.keys(goalLabels) as NutritionGoal[]).map((id) => (
          <button key={id} type="button" role="radio" aria-checked={goal === id} className={`nai-chip nai-chip-btn${goal === id ? ' active' : ''}`} onClick={() => setGoal(id)}>{goalLabels[id]}</button>
        ))}
      </div>
      <div className="nai-form">
        <label>Calorías (kcal)<input className="nai-input" inputMode="decimal" value={draft.calories} onChange={(event) => setDraft({ ...draft, calories: event.target.value })} /></label>
        <label>Proteínas (g)<input className="nai-input" inputMode="decimal" value={draft.protein} onChange={(event) => setDraft({ ...draft, protein: event.target.value })} /></label>
        <label>Grasas (g)<input className="nai-input" inputMode="decimal" value={draft.fat} onChange={(event) => setDraft({ ...draft, fat: event.target.value })} /></label>
        <label>Carbohidratos (g) · automático<input className="nai-input" readOnly value={preview ? preview.carbohydrates : '—'} /></label>
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
      <div className="nai-actions">
        <button type="button" className="nai-btn" onClick={recalc}>Calcular desde mi perfil</button>
        <button type="button" className="nai-btn nai-primary" onClick={save}>Guardar objetivos</button>
      </div>
      {message && <p className="nai-muted" role="status">{message}</p>}
    </section>
  );
}

function Recipes({ ctx }: { ctx: NutritionCtx }) {
  const { ai, updateAI } = ctx;
  const [name, setName] = useState('');
  const [servings, setServings] = useState('1');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [logMeal, setLogMeal] = useState<MealType>('comida');
  const foods = useMemo(() => [...ai.customFoods, ...referenceFoods], [ai.customFoods]);

  const draft: Recipe = { id: 'draft', name, servings: Math.max(1, parse(servings) ?? 1), ingredients };
  const per = recipePerServing(draft);

  const save = () => {
    if (!name.trim() || ingredients.length === 0) return setError('Añade un nombre y al menos un ingrediente.');
    updateAI((current) => ({ ...current, recipes: [...current.recipes, { ...draft, id: newId('recipe'), name: name.trim() }] }));
    setName('');
    setServings('1');
    setIngredients([]);
    setError('');
  };

  const logRecipe = (recipe: Recipe) => {
    const macros = recipePerServing(recipe);
    ctx.addEntries(ctx.today, [makeMealEntry({ name: `${recipe.name} (1 ración)`, mealType: logMeal, macros: { calories: round0(macros.calories), protein: round1(macros.protein), carbohydrates: round1(macros.carbohydrates), fat: round1(macros.fat), fiber: round1(macros.fiber ?? 0) }, source: 'recipe', foods: recipe.ingredients.map((item) => item.name) })]);
  };

  return (
    <section className="nai-card">
      <header className="nai-card-head"><h3>Recetas</h3></header>
      <div className="nai-form">
        <input className="nai-input nai-wide" placeholder="Nombre de la receta" aria-label="Nombre de la receta" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        <label>Raciones<input className="nai-input" inputMode="numeric" value={servings} onChange={(event) => setServings(event.target.value)} /></label>
      </div>
      <ul className="nai-list">
        {ingredients.map((item, index) => (
          <li key={`${item.name}-${index}`}>
            <div>
              <strong>{item.name}</strong>
              <small>{macroText(scalePer100(item.per100, item.grams))}</small>
            </div>
            <input className="nai-input nai-small" aria-label={`Gramos de ${item.name}`} inputMode="decimal" defaultValue={item.grams} onBlur={(event) => { const grams = parse(event.target.value); if (grams !== null && grams <= 5000) setIngredients((current) => current.map((entry, position) => (position === index ? { ...entry, grams } : entry))); }} />
            <button type="button" className="nai-icon-btn" aria-label={`Quitar ${item.name}`} onClick={() => setIngredients((current) => current.filter((_, position) => position !== index))}>✕</button>
          </li>
        ))}
      </ul>
      <input className="nai-input" placeholder="Buscar ingrediente para añadir" aria-label="Buscar ingrediente" value={query} onChange={(event) => setQuery(event.target.value)} />
      <ul className="nai-list nai-results">
        {searchFoods(foods, query, 5).map((food) => (
          <li key={food.id}><button type="button" className="nai-result" onClick={() => { setIngredients((current) => [...current, { name: food.name, grams: 100, per100: food.per100, foodId: food.id }]); setQuery(''); }}><strong>{food.name}</strong><small>Añadir 100 {food.unit}</small></button></li>
        ))}
      </ul>
      {ingredients.length > 0 && <p><strong>Por ración:</strong> {macroText(per)} <span className="nai-muted">(total {macroText(recipeTotals(draft))})</span></p>}
      {error && <p className="nai-error" role="alert">{error}</p>}
      <button type="button" className="nai-btn nai-primary" onClick={save}>Guardar receta</button>

      {ai.recipes.length > 0 && (
        <>
          <h4>Mis recetas</h4>
          <label className="nai-inline">Registrar en
            <select className="nai-input" value={logMeal} onChange={(event) => setLogMeal(event.target.value as MealType)}>{mealTypes.map((meal) => <option key={meal.id} value={meal.id}>{meal.label}</option>)}</select>
          </label>
          <ul className="nai-list">
            {ai.recipes.map((recipe) => (
              <li key={recipe.id}>
                <div><strong>{recipe.name}</strong><small>Ración: {macroText(recipePerServing(recipe))}</small></div>
                <button type="button" className="nai-btn" onClick={() => logRecipe(recipe)}>Registrar 1 ración</button>
                <button type="button" className="nai-icon-btn" aria-label={`Eliminar ${recipe.name}`} onClick={() => updateAI((current) => ({ ...current, recipes: current.recipes.filter((item) => item.id !== recipe.id) }))}>✕</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function FavoriteMeals({ ctx }: { ctx: NutritionCtx }) {
  const { ai, updateAI } = ctx;
  const [meal, setMeal] = useState<MealType>('desayuno');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const todayMeals = entriesByMeal(ctx.entriesByDay[ctx.today])[meal];

  const save = () => {
    if (!name.trim()) return setMessage('Ponle un nombre a la comida.');
    if (todayMeals.length === 0) return setMessage('Hoy no hay alimentos en esa comida. Regístralos primero en el Diario.');
    const items = todayMeals.map((entry) => ({ name: entry.description ?? 'Alimento', grams: entry.grams ?? 0, macros: entryMacros(entry) }));
    updateAI((current) => ({ ...current, savedMeals: [...current.savedMeals, { id: newId('saved'), name: name.trim(), mealType: meal, items }] }));
    setName('');
    setMessage('Comida guardada en favoritas.');
  };

  const add = (id: string) => {
    const saved = ai.savedMeals.find((item) => item.id === id);
    if (!saved) return;
    ctx.addEntries(ctx.today, saved.items.map((item) => makeMealEntry({ name: item.name, mealType: saved.mealType, macros: item.macros, grams: item.grams || undefined, source: 'copy' })));
  };

  return (
    <section className="nai-card">
      <header className="nai-card-head"><h3>Comidas favoritas</h3></header>
      <div className="nai-row">
        <select className="nai-input" aria-label="Comida de hoy a guardar" value={meal} onChange={(event) => setMeal(event.target.value as MealType)}>{mealTypes.map((item) => <option key={item.id} value={item.id}>{item.label} de hoy</option>)}</select>
        <input className="nai-input" placeholder="Nombre" aria-label="Nombre de la comida favorita" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
        <button type="button" className="nai-btn" onClick={save}>Guardar favorita</button>
      </div>
      {message && <p className="nai-muted" role="status">{message}</p>}
      {ai.savedMeals.length === 0 ? <p className="nai-empty">Aún no tienes comidas favoritas.</p> : (
        <ul className="nai-list">
          {ai.savedMeals.map((saved) => (
            <li key={saved.id}>
              <div><strong>{saved.name}</strong><small>{macroText(saved.items.reduce((sum, item) => addMacros(sum, item.macros), emptyMacros()))}</small></div>
              <button type="button" className="nai-btn" onClick={() => add(saved.id)}>Añadir hoy</button>
              <button type="button" className="nai-icon-btn" aria-label={`Eliminar ${saved.name}`} onClick={() => updateAI((current) => ({ ...current, savedMeals: current.savedMeals.filter((item) => item.id !== saved.id) }))}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WeekPlan({ ctx }: { ctx: NutritionCtx }) {
  const { ai, updateAI } = ctx;
  const todayIndex = parseDateKey(ctx.today).getDay();
  const [day, setDay] = useState(todayIndex);
  const [meal, setMeal] = useState<MealType>('desayuno');
  const [source, setSource] = useState('');
  const [grams, setGrams] = useState('100');
  const [query, setQuery] = useState('');
  const foods = useMemo(() => [...ai.customFoods, ...referenceFoods], [ai.customFoods]);
  const plan: PlanDay = ai.weekPlan[day] ?? emptyPlanDay();
  const perMeal = splitByMeals(ctx.targets, ai.mealSplit);
  const planTotal = mealTypes.reduce((sum, item) => plan[item.id].reduce((inner, planned) => addMacros(inner, planned.macros), sum), emptyMacros());

  const setDayPlan = (index: number, next: PlanDay) => updateAI((current) => ({ ...current, weekPlan: { ...current.weekPlan, [index]: next } }));
  const addItem = (item: PlannedItem) => setDayPlan(day, { ...plan, [meal]: [...plan[meal], item] });

  const addRecipe = () => {
    const recipe = ai.recipes.find((candidate) => candidate.id === source);
    if (!recipe) return;
    addItem({ id: newId('plan'), name: `${recipe.name} (1 ración)`, macros: recipePerServing(recipe), recipeId: recipe.id });
  };
  const addFood = (foodId: string) => {
    const food = foods.find((candidate) => candidate.id === foodId);
    const amount = parse(grams);
    if (!food || amount === null || amount <= 0) return;
    addItem({ id: newId('plan'), name: `${food.name} (${amount} ${food.unit})`, grams: amount, macros: scalePer100(food.per100, amount) });
    setQuery('');
  };

  const applyToDiary = () => {
    const entries = mealTypes.flatMap((item) => plan[item.id].map((planned) => makeMealEntry({ name: planned.name, mealType: item.id, macros: { ...planned.macros, calories: round0(planned.macros.calories), protein: round1(planned.macros.protein), carbohydrates: round1(planned.macros.carbohydrates), fat: round1(planned.macros.fat) }, grams: planned.grams, source: 'plan' })));
    if (entries.length) ctx.addEntries(ctx.today, entries);
  };
  const duplicateTo = (target: number) => setDayPlan(target, JSON.parse(JSON.stringify(plan)) as PlanDay);
  const delta = planTotal.calories - ctx.targets.calories;

  return (
    <section className="nai-card">
      <header className="nai-card-head"><h3>Plan semanal</h3></header>
      <div className="nai-chips" role="tablist" aria-label="Día del plan">
        {weekdayOrder.map((index) => {
          const info = ctx.plan[index];
          return <button key={index} type="button" role="tab" aria-selected={day === index} className={`nai-chip nai-chip-btn${day === index ? ' active' : ''}`} onClick={() => setDay(index)}>{weekdays[index]}{info ? ' 🏋' : ''}</button>;
        })}
      </div>
      <p className="nai-muted">
        {ctx.plan[day] ? `Entrenamiento: ${ctx.plan[day]?.name ?? ''}` : 'Descanso'} · Plan: {round0(planTotal.calories)} kcal ({delta >= 0 ? '+' : ''}{round0(delta)} vs objetivo) · P {round0(planTotal.protein)} g · C {round0(planTotal.carbohydrates)} g · G {round0(planTotal.fat)} g
      </p>
      {mealTypes.map((item) => (
        <div key={item.id} className="nai-plan-meal">
          <strong>{item.label} <small className="nai-muted">objetivo {perMeal[item.id].calories} kcal</small></strong>
          <ul className="nai-list">
            {plan[item.id].map((planned) => (
              <li key={planned.id}>
                <div><span>{planned.name}</span><small>{macroText(planned.macros)}</small></div>
                <button type="button" className="nai-icon-btn" aria-label={`Quitar ${planned.name}`} onClick={() => setDayPlan(day, { ...plan, [item.id]: plan[item.id].filter((x) => x.id !== planned.id) })}>✕</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="nai-add">
        <div className="nai-row">
          <select className="nai-input" aria-label="Comida" value={meal} onChange={(event) => setMeal(event.target.value as MealType)}>{mealTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          {ai.recipes.length > 0 && (
            <>
              <select className="nai-input" aria-label="Receta" value={source} onChange={(event) => setSource(event.target.value)}><option value="">Receta…</option>{ai.recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</select>
              <button type="button" className="nai-btn" onClick={addRecipe} disabled={!source}>Añadir receta</button>
            </>
          )}
        </div>
        <div className="nai-row">
          <input className="nai-input" placeholder="Buscar alimento" aria-label="Buscar alimento para el plan" value={query} onChange={(event) => setQuery(event.target.value)} />
          <label className="nai-inline">g<input className="nai-input nai-small" inputMode="decimal" value={grams} onChange={(event) => setGrams(event.target.value)} /></label>
        </div>
        <ul className="nai-list nai-results">
          {searchFoods(foods, query, 5).map((food) => <li key={food.id}><button type="button" className="nai-result" onClick={() => addFood(food.id)}><strong>{food.name}</strong><small>Añadir al plan</small></button></li>)}
        </ul>
      </div>
      <div className="nai-actions">
        {day === todayIndex && <button type="button" className="nai-btn nai-primary" onClick={applyToDiary}>Registrar el plan de hoy en el diario</button>}
        <label className="nai-inline">Duplicar este día en
          <select className="nai-input" value="" onChange={(event) => { if (event.target.value !== '') duplicateTo(Number(event.target.value)); }}>
            <option value="">Elegir…</option>
            {weekdayOrder.filter((index) => index !== day).map((index) => <option key={index} value={index}>{weekdays[index]}</option>)}
          </select>
        </label>
      </div>
    </section>
  );
}

export default function Planner({ ctx }: { ctx: NutritionCtx }) {
  return (
    <div className="nai-stack">
      <TargetsEditor ctx={ctx} />
      <WeekPlan ctx={ctx} />
      <Recipes ctx={ctx} />
      <FavoriteMeals ctx={ctx} />
    </div>
  );
}
