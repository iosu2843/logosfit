import { useMemo, useState, type FormEvent } from 'react';
import { addDaysToKey, dayTotals, entriesByMeal, entryMacros, round0, round1, scalePer100 } from './calc';
import type { NutritionCtx } from './ctx';
import { referenceFoods, searchFoods } from './foods';
import { duplicateMeals, makeMealEntry, newId } from './store';
import { mealLabel, mealTypes, type FoodItem, type MealType } from './types';

const numberOf = (text: string) => {
  const value = Number(text.replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) && value >= 0 ? value : null;
};

const blankManual = { name: '', amount: '', unit: 'g' as 'g' | 'ml', calories: '', protein: '', carbohydrates: '', fat: '', save: false };

export default function FoodLog({ ctx }: { ctx: NutritionCtx }) {
  const { ai, updateAI, addEntries, removeEntry } = ctx;
  const [date, setDate] = useState(ctx.today);
  const [openMeal, setOpenMeal] = useState<MealType | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<FoodItem | null>(null);
  const [amount, setAmount] = useState('100');
  const [manual, setManual] = useState(blankManual);
  const [error, setError] = useState('');
  const [copyFrom, setCopyFrom] = useState(addDaysToKey(ctx.today, -1));

  const allFoods = useMemo(() => [...ai.customFoods, ...referenceFoods], [ai.customFoods]);
  const results = useMemo(() => searchFoods(allFoods, query, 8), [allFoods, query]);
  const quick = useMemo(() => {
    const favorites = allFoods.filter((food) => ai.favoriteFoodIds.includes(food.id));
    const frequent = allFoods.filter((food) => (ai.usage[food.id] ?? 0) > 1 && !ai.favoriteFoodIds.includes(food.id)).sort((a, b) => (ai.usage[b.id] ?? 0) - (ai.usage[a.id] ?? 0)).slice(0, 5);
    return [...favorites, ...frequent];
  }, [allFoods, ai.favoriteFoodIds, ai.usage]);

  const entries = ctx.entriesByDay[date];
  const grouped = entriesByMeal(entries);
  const totals = dayTotals(entries);
  const others = (entries ?? []).filter((entry) => entry.kind !== 'meal');

  const close = () => {
    setOpenMeal(null);
    setQuery('');
    setPicked(null);
    setAmount('100');
    setManual(blankManual);
    setError('');
  };

  const bumpUsage = (id: string) => updateAI((current) => ({ ...current, usage: { ...current.usage, [id]: (current.usage[id] ?? 0) + 1 } }));

  const addPicked = (event: FormEvent) => {
    event.preventDefault();
    const grams = numberOf(amount);
    if (!picked || !openMeal || grams === null || grams <= 0 || grams > 5000) return setError('Indica una cantidad entre 1 y 5000.');
    const macros = scalePer100(picked.per100, grams);
    addEntries(date, [makeMealEntry({ name: `${picked.name} (${grams} ${picked.unit})`, mealType: openMeal, macros: { ...macros, calories: round0(macros.calories), protein: round1(macros.protein), carbohydrates: round1(macros.carbohydrates), fat: round1(macros.fat), fiber: round1(macros.fiber ?? 0) }, grams, source: picked.source === 'USDA' ? 'database' : 'manual', foods: [picked.name] })]);
    bumpUsage(picked.id);
    close();
  };

  const addManual = (event: FormEvent) => {
    event.preventDefault();
    const calories = numberOf(manual.calories);
    const protein = numberOf(manual.protein) ?? 0;
    const carbohydrates = numberOf(manual.carbohydrates) ?? 0;
    const fat = numberOf(manual.fat) ?? 0;
    const grams = numberOf(manual.amount);
    if (!manual.name.trim() || !openMeal) return setError('Escribe el nombre del alimento.');
    if (calories === null) return setError('Indica las calorías (copia el dato de la etiqueta).');
    if ([calories, protein, carbohydrates, fat].some((value) => value > 10000)) return setError('Valores demasiado altos.');
    addEntries(date, [makeMealEntry({ name: manual.name.trim(), mealType: openMeal, macros: { calories, protein, carbohydrates, fat }, grams: grams ?? undefined, source: 'manual' })]);
    if (manual.save && grams && grams > 0) {
      const factor = 100 / grams;
      const food: FoodItem = { id: newId('food'), name: manual.name.trim(), unit: manual.unit, source: 'usuario', per100: { calories: round1(calories * factor), protein: round1(protein * factor), carbohydrates: round1(carbohydrates * factor), fat: round1(fat * factor) } };
      updateAI((current) => ({ ...current, customFoods: [...current.customFoods, food], favoriteFoodIds: [...current.favoriteFoodIds, food.id] }));
    }
    close();
  };

  const toggleFavorite = (id: string) =>
    updateAI((current) => ({ ...current, favoriteFoodIds: current.favoriteFoodIds.includes(id) ? current.favoriteFoodIds.filter((item) => item !== id) : [...current.favoriteFoodIds, id] }));

  const copyDay = () => {
    const source = ctx.entriesByDay[copyFrom];
    const copies = duplicateMeals(source ?? []);
    if (copies.length === 0) return setError('Ese día no tiene comidas registradas.');
    if (copyFrom === date) return setError('Elige un día distinto al actual.');
    addEntries(date, copies);
    setError('');
  };

  return (
    <div className="nai-stack">
      <section className="nai-card">
        <header className="nai-card-head">
          <h3>Diario de alimentos</h3>
          <input type="date" aria-label="Fecha del diario" className="nai-input" value={date} max={ctx.today} onChange={(event) => event.target.value && setDate(event.target.value)} />
        </header>
        <p className="nai-muted">
          {round0(totals.macros.calories)} / {round0(ctx.targets.calories)} kcal · P {round0(totals.macros.protein)} g · C {round0(totals.macros.carbohydrates)} g · G {round0(totals.macros.fat)} g
        </p>
        <div className="nai-row">
          <label className="nai-inline">Copiar comidas del día
            <input type="date" className="nai-input" value={copyFrom} max={ctx.today} onChange={(event) => setCopyFrom(event.target.value)} />
          </label>
          <button type="button" className="nai-btn" onClick={copyDay}>Duplicar aquí</button>
        </div>
        {error && !openMeal && <p className="nai-error" role="alert">{error}</p>}
      </section>

      {mealTypes.map((meal) => {
        const list = grouped[meal.id];
        const kcal = list.reduce((sum, entry) => sum + (entry.macros?.calories ?? 0), 0);
        const isOpen = openMeal === meal.id;
        return (
          <section key={meal.id} className="nai-card">
            <header className="nai-card-head">
              <h3>{meal.label}</h3>
              <span className="nai-muted">{round0(kcal)} kcal</span>
            </header>
            {list.length === 0 && !isOpen && <p className="nai-empty">Sin alimentos.</p>}
            <ul className="nai-list">
              {list.map((entry) => {
                const macros = entryMacros(entry);
                return (
                  <li key={entry.id}>
                    <div>
                      <strong>{entry.description}</strong>
                      <small>{round0(macros.calories)} kcal · P {round1(macros.protein)} · C {round1(macros.carbohydrates)} · G {round1(macros.fat)}{entry.source === 'scanner' ? ' · estimado por IA' : ''}</small>
                    </div>
                    <button type="button" className="nai-icon-btn" aria-label={`Eliminar ${entry.description}`} onClick={() => removeEntry(date, entry.id)}>✕</button>
                  </li>
                );
              })}
            </ul>

            {!isOpen ? (
              <button type="button" className="nai-btn" onClick={() => { close(); setOpenMeal(meal.id); }}>+ Añadir a {meal.label.toLowerCase()}</button>
            ) : (
              <div className="nai-add">
                {quick.length > 0 && !picked && (
                  <div className="nai-chips" aria-label="Alimentos frecuentes y favoritos">
                    {quick.map((food) => <button key={food.id} type="button" className="nai-chip nai-chip-btn" onClick={() => { setPicked(food); setAmount('100'); }}>★ {food.name}</button>)}
                  </div>
                )}
                {!picked ? (
                  <>
                    <input className="nai-input" placeholder="Buscar alimento (p. ej. pollo, arroz...)" aria-label="Buscar alimento" value={query} onChange={(event) => setQuery(event.target.value)} />
                    <ul className="nai-list nai-results">
                      {results.map((food) => (
                        <li key={food.id}>
                          <button type="button" className="nai-result" onClick={() => { setPicked(food); setAmount('100'); }}>
                            <strong>{food.name}</strong>
                            <small>{food.per100.calories} kcal · P {food.per100.protein} · C {food.per100.carbohydrates} · G {food.per100.fat} por 100 {food.unit} · {food.source}</small>
                          </button>
                          <button type="button" className="nai-icon-btn" aria-label={`Favorito ${food.name}`} onClick={() => toggleFavorite(food.id)}>{ai.favoriteFoodIds.includes(food.id) ? '★' : '☆'}</button>
                        </li>
                      ))}
                    </ul>
                    {query.trim() && results.length === 0 && <p className="nai-muted">Sin resultados en la base de datos. Añádelo manualmente abajo con los valores de su etiqueta.</p>}

                    <details className="nai-details">
                      <summary>Añadir manualmente</summary>
                      <form className="nai-form" onSubmit={addManual}>
                        <input className="nai-input nai-wide" placeholder="Nombre" aria-label="Nombre del alimento" value={manual.name} onChange={(event) => setManual({ ...manual, name: event.target.value })} maxLength={80} />
                        <label>Cantidad<input className="nai-input" inputMode="decimal" value={manual.amount} onChange={(event) => setManual({ ...manual, amount: event.target.value })} /></label>
                        <label>Unidad<select className="nai-input" value={manual.unit} onChange={(event) => setManual({ ...manual, unit: event.target.value as 'g' | 'ml' })}><option value="g">g</option><option value="ml">ml</option></select></label>
                        <label>Calorías (kcal)<input className="nai-input" inputMode="decimal" value={manual.calories} onChange={(event) => setManual({ ...manual, calories: event.target.value })} /></label>
                        <label>Proteínas (g)<input className="nai-input" inputMode="decimal" value={manual.protein} onChange={(event) => setManual({ ...manual, protein: event.target.value })} /></label>
                        <label>Carbohidratos (g)<input className="nai-input" inputMode="decimal" value={manual.carbohydrates} onChange={(event) => setManual({ ...manual, carbohydrates: event.target.value })} /></label>
                        <label>Grasas (g)<input className="nai-input" inputMode="decimal" value={manual.fat} onChange={(event) => setManual({ ...manual, fat: event.target.value })} /></label>
                        <label className="nai-check nai-wide"><input type="checkbox" checked={manual.save} onChange={(event) => setManual({ ...manual, save: event.target.checked })} /> Guardar como alimento frecuente (requiere cantidad)</label>
                        <p className="nai-muted nai-wide">Los valores corresponden a la cantidad indicada. Usa datos de la etiqueta o de una fuente fiable.</p>
                        <button type="submit" className="nai-btn nai-primary nai-wide">Añadir</button>
                      </form>
                    </details>
                  </>
                ) : (
                  <form className="nai-form" onSubmit={addPicked}>
                    <p className="nai-wide"><strong>{picked.name}</strong> <small className="nai-muted">({picked.source})</small></p>
                    <label>Cantidad ({picked.unit})<input className="nai-input" inputMode="decimal" autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
                    <p className="nai-muted nai-wide">
                      {(() => {
                        const grams = numberOf(amount);
                        if (grams === null) return 'Escribe una cantidad.';
                        const macros = scalePer100(picked.per100, grams);
                        return `${round0(macros.calories)} kcal · P ${round1(macros.protein)} g · C ${round1(macros.carbohydrates)} g · G ${round1(macros.fat)} g`;
                      })()}
                    </p>
                    <button type="submit" className="nai-btn nai-primary">Añadir a {mealLabel(openMeal ?? undefined).toLowerCase()}</button>
                    <button type="button" className="nai-btn" onClick={() => setPicked(null)}>Volver</button>
                  </form>
                )}
                {error && <p className="nai-error" role="alert">{error}</p>}
                <button type="button" className="nai-link" onClick={close}>Cerrar</button>
              </div>
            )}
          </section>
        );
      })}

      {others.length > 0 && (
        <section className="nai-card">
          <header className="nai-card-head"><h3>Agua y proteína suelta</h3></header>
          <ul className="nai-list">
            {others.map((entry) => (
              <li key={entry.id}>
                <div><strong>{entry.kind === 'water' ? 'Agua' : 'Proteína'}</strong><small>+{entry.amount} {entry.kind === 'water' ? 'ml' : 'g'}</small></div>
                <button type="button" className="nai-icon-btn" aria-label="Eliminar registro" onClick={() => removeEntry(date, entry.id)}>✕</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
