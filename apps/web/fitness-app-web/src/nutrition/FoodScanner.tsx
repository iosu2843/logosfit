import { useEffect, useMemo, useRef, useState } from 'react';
import { round0, round1, scalePer100 } from './calc';
import type { NutritionCtx } from './ctx';
import { matchFood, referenceFoods, searchFoods } from './foods';
import { rescaleIngredient, scanTotals, ScannerError, type ScanIngredient, type ScanResult } from './scanner';
import { getScannerProvider, isScannerConfigured, prepareImage } from './scannerService';
import { makeMealEntry } from './store';
import { mealTypes, type MealType } from './types';

type Status = 'idle' | 'analyzing' | 'review' | 'saved';

const defaultMealForNow = (): MealType => {
  const hour = new Date().getHours();
  if (hour < 11) return 'desayuno';
  if (hour < 13) return 'media-manana';
  if (hour < 17) return 'comida';
  if (hour < 20) return 'merienda';
  return 'cena';
};

const range = (min: number, max: number, unit: string) => `${round0(min)}–${round0(max)} ${unit}`;

export default function FoodScanner({ ctx }: { ctx: NutritionCtx }) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [items, setItems] = useState<ScanIngredient[]>([]);
  const [dishName, setDishName] = useState('');
  const [mealType, setMealType] = useState<MealType>(defaultMealForNow);
  const [addQuery, setAddQuery] = useState('');
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const allFoods = useMemo(() => [...ctx.ai.customFoods, ...referenceFoods], [ctx.ai.customFoods]);
  const totals = useMemo(() => scanTotals(items), [items]);

  const reset = () => {
    abort.current?.abort();
    setStatus('idle');
    setResult(null);
    setItems([]);
    setError('');
    setPreview(null);
    setAddQuery('');
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const provider = getScannerProvider();
    if (!provider) return;
    setError('');
    setResult(null);
    setPreview(URL.createObjectURL(file));
    setStatus('analyzing');
    abort.current?.abort();
    abort.current = new AbortController();
    try {
      const image = await prepareImage(file);
      const analysis = await provider.analyze(image, abort.current.signal);
      setResult(analysis);
      setItems(analysis.ingredients);
      setDishName(analysis.dishName ?? 'Plato');
      setStatus('review');
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(caught instanceof ScannerError || caught instanceof Error ? caught.message : 'No se pudo analizar la imagen.');
      setStatus('idle');
    }
  };

  const updateItem = (index: number, change: (item: ScanIngredient) => ScanIngredient) => setItems((current) => current.map((item, position) => (position === index ? change(item) : item)));

  const useReference = (index: number) => {
    const item = items[index];
    const food = matchFood(allFoods, item.name);
    if (!food) return setError(`No hay referencia en la base de datos para "${item.name}".`);
    setError('');
    const macros = scalePer100(food.per100, item.grams);
    updateItem(index, (current) => ({ ...current, calories: round1(macros.calories), protein: round1(macros.protein), carbohydrates: round1(macros.carbohydrates), fat: round1(macros.fat), fiber: round1(macros.fiber ?? 0), name: current.name }));
  };

  const addFood = (foodId: string) => {
    const food = allFoods.find((candidate) => candidate.id === foodId);
    if (!food) return;
    const macros = scalePer100(food.per100, 100);
    setItems((current) => [...current, { name: food.name, category: 'ingrediente', grams: 100, gramsMin: 100, gramsMax: 100, calories: macros.calories, protein: macros.protein, carbohydrates: macros.carbohydrates, fat: macros.fat, fiber: macros.fiber }]);
    setAddQuery('');
  };

  const confirm = () => {
    if (items.length === 0) return setError('Añade al menos un ingrediente para registrar.');
    ctx.addEntries(ctx.today, [
      makeMealEntry({
        name: `${dishName.trim() || 'Plato'} (estimado por IA)`,
        mealType,
        macros: { calories: round0(totals.total.calories), protein: round1(totals.total.protein), carbohydrates: round1(totals.total.carbohydrates), fat: round1(totals.total.fat), fiber: round1(totals.total.fiber ?? 0) },
        grams: round0(items.reduce((sum, item) => sum + item.grams, 0)),
        source: 'scanner',
        foods: items.map((item) => item.name),
      }),
    ]);
    setStatus('saved');
  };

  if (!isScannerConfigured) {
    return (
      <section className="nai-card">
        <header className="nai-card-head"><h3>Food Scanner AI</h3><span className="nai-chip">No configurado</span></header>
        <p>El análisis de fotos necesita un servicio de IA conectado a un backend seguro. Todavía no hay ninguno configurado, así que <strong>no se realiza ningún análisis</strong> (no se muestran resultados simulados).</p>
        <ol className="nai-steps">
          <li>Despliega la función <code>supabase/functions/food-scan</code> con tu clave de IA como secreto (la clave nunca llega a la app).</li>
          <li>Define <code>VITE_FOOD_SCANNER_URL</code> en <code>.env.local</code> y en los secretos de GitHub Actions.</li>
          <li>Vuelve a compilar y desplegar la app.</li>
        </ol>
        <p className="nai-muted">Mientras tanto puedes registrar alimentos desde el Diario con valores de la base de datos o de la etiqueta.</p>
      </section>
    );
  }

  if (status === 'saved') {
    return (
      <section className="nai-card">
        <h3>Registrado</h3>
        <p>El plato se ha añadido a tu diario de hoy como estimación.</p>
        <button type="button" className="nai-btn nai-primary" onClick={reset}>Analizar otro plato</button>
      </section>
    );
  }

  return (
    <div className="nai-stack">
      <section className="nai-card">
        <header className="nai-card-head"><h3>Food Scanner AI</h3></header>
        <p className="nai-muted">Haz una foto a tu plato o elige una imagen. La IA estima alimentos y cantidades; tú revisas y confirmas antes de registrar nada.</p>
        <div className="nai-actions">
          <label className="nai-btn nai-primary">
            Hacer foto
            <input type="file" accept="image/*" capture="environment" hidden disabled={status === 'analyzing'} onChange={(event) => { void handleFile(event.target.files?.[0]); event.target.value = ''; }} />
          </label>
          <label className="nai-btn">
            Elegir de la galería
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={status === 'analyzing'} onChange={(event) => { void handleFile(event.target.files?.[0]); event.target.value = ''; }} />
          </label>
        </div>
        {error && <p className="nai-error" role="alert">{error}</p>}
        {status === 'analyzing' && <p role="status">Analizando imagen…</p>}
        {preview && <img className="nai-preview" src={preview} alt="Foto del plato" />}
      </section>

      {status === 'review' && result && (
        <section className="nai-card">
          <header className="nai-card-head"><h3>Revisa la estimación</h3></header>
          <div className="nai-notice">
            Son <strong>estimaciones</strong>: una foto no permite saber el peso exacto, los ingredientes ocultos ni el aceite usado. Corrige lo que no sea correcto.
          </div>
          {result.notes.map((note) => <p key={note} className="nai-muted">• {note}</p>)}

          <label className="nai-inline">Nombre del plato
            <input className="nai-input" value={dishName} maxLength={80} onChange={(event) => setDishName(event.target.value)} />
          </label>

          {items.length === 0 && <p className="nai-empty">No se detectaron alimentos. Puedes añadirlos manualmente abajo.</p>}
          <ul className="nai-list nai-scan-list">
            {items.map((item, index) => (
              <li key={`${item.name}-${index}`}>
                <div className="nai-scan-main">
                  <input className="nai-input" aria-label="Nombre del ingrediente" value={item.name} maxLength={80} onChange={(event) => updateItem(index, (current) => ({ ...current, name: event.target.value }))} />
                  <label className="nai-inline">g
                    <input className="nai-input nai-small" inputMode="decimal" aria-label={`Gramos de ${item.name}`} defaultValue={item.grams} key={`${index}-${item.grams}`} onBlur={(event) => {
                      const grams = Number(event.target.value.replace(',', '.'));
                      if (Number.isFinite(grams) && grams >= 0 && grams <= 5000) updateItem(index, (current) => rescaleIngredient(current, grams));
                    }} />
                  </label>
                  <button type="button" className="nai-icon-btn" aria-label={`Quitar ${item.name}`} onClick={() => setItems((current) => current.filter((_, position) => position !== index))}>✕</button>
                </div>
                <small>
                  {item.category}{item.cooking ? ` · ${item.cooking}` : ''} · {round0(item.calories)} kcal · P {round1(item.protein)} · C {round1(item.carbohydrates)} · G {round1(item.fat)}
                  {item.gramsMin !== undefined && item.gramsMax !== undefined ? ` · rango ${round0(item.gramsMin)}–${round0(item.gramsMax)} g` : ''}
                  {item.confidence !== undefined ? ` · confianza ${Math.round(item.confidence * 100)} %` : ''}
                </small>
                <button type="button" className="nai-link" onClick={() => useReference(index)}>Usar valores de referencia (USDA)</button>
              </li>
            ))}
          </ul>

          <div className="nai-add">
            <input className="nai-input" placeholder="Añadir ingrediente (buscar en la base de datos)" aria-label="Añadir ingrediente" value={addQuery} onChange={(event) => setAddQuery(event.target.value)} />
            <ul className="nai-list nai-results">
              {searchFoods(allFoods, addQuery, 5).map((food) => <li key={food.id}><button type="button" className="nai-result" onClick={() => addFood(food.id)}><strong>{food.name}</strong><small>Añadir 100 {food.unit}</small></button></li>)}
            </ul>
          </div>

          <div className="nai-totals">
            <h4>Total estimado</h4>
            <p><strong>{round0(totals.total.calories)} kcal</strong> <span className="nai-muted">(rango {range(totals.min.calories, totals.max.calories, 'kcal')})</span></p>
            <p>Proteínas {round1(totals.total.protein)} g <span className="nai-muted">({range(totals.min.protein, totals.max.protein, 'g')})</span></p>
            <p>Carbohidratos {round1(totals.total.carbohydrates)} g <span className="nai-muted">({range(totals.min.carbohydrates, totals.max.carbohydrates, 'g')})</span></p>
            <p>Grasas {round1(totals.total.fat)} g <span className="nai-muted">({range(totals.min.fat, totals.max.fat, 'g')})</span></p>
            {(totals.total.fiber ?? 0) > 0 && <p>Fibra {round1(totals.total.fiber ?? 0)} g</p>}
            {totals.usesGenericMargin && <p className="nai-muted">Algunos ingredientes no traían rango: se usa un margen genérico (±25 %, ±50 % en salsas y aceites).</p>}
          </div>

          <div className="nai-row">
            <label className="nai-inline">Registrar en
              <select className="nai-input" value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}>
                {mealTypes.map((meal) => <option key={meal.id} value={meal.id}>{meal.label}</option>)}
              </select>
            </label>
            <button type="button" className="nai-btn nai-primary" onClick={confirm}>Confirmar y registrar</button>
            <button type="button" className="nai-btn" onClick={reset}>Descartar</button>
          </div>
          <p className="nai-muted">Se registrará el valor central de la estimación. No sustituye la información de una etiqueta ni el consejo de un profesional.</p>
        </section>
      )}
    </div>
  );
}
