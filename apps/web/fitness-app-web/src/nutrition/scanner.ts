import type { Macros } from './types';
import { addMacros, emptyMacros, round1 } from './calc';

export type ScanCategory = 'ingrediente' | 'salsa' | 'aceite' | 'acompañamiento';

export type ScanIngredient = {
  name: string;
  category: ScanCategory;
  cooking?: string;
  grams: number;
  gramsMin?: number;
  gramsMax?: number;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber?: number;
  confidence?: number;
};

export type ScanResult = {
  dishName?: string;
  ingredients: ScanIngredient[];
  notes: string[];
  provider?: string;
};

export type PreparedImage = { base64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' };

export type ScannerErrorCode = 'not-configured' | 'unauthorized' | 'rate-limited' | 'too-large' | 'network' | 'invalid-response' | 'server';

export class ScannerError extends Error {
  readonly code: ScannerErrorCode;

  constructor(code: ScannerErrorCode, message: string) {
    super(message);
    this.name = 'ScannerError';
    this.code = code;
  }
}

/** Contrato que debe cumplir cualquier proveedor de análisis de imágenes. Cambiar de proveedor solo exige otra implementación. */
export interface FoodScannerProvider {
  readonly id: string;
  analyze(image: PreparedImage, signal?: AbortSignal): Promise<ScanResult>;
}

const categories: ScanCategory[] = ['ingrediente', 'salsa', 'aceite', 'acompañamiento'];
const MAX_INGREDIENTS = 30;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function readNumber(source: Record<string, unknown>, key: string, max: number, required: boolean): number | undefined {
  const value = source[key];
  if (value === undefined || value === null) {
    if (required) throw new ScannerError('invalid-response', `Falta el campo numérico "${key}".`);
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) {
    throw new ScannerError('invalid-response', `Valor no válido en "${key}".`);
  }
  return value;
}

function readText(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : undefined;
}

/** Valida estrictamente la respuesta del backend. Nada de lo que devuelva el modelo se usa sin pasar por aquí. */
export function parseScanResult(raw: unknown): ScanResult {
  if (!isRecord(raw) || !Array.isArray(raw.ingredients)) {
    throw new ScannerError('invalid-response', 'La respuesta del análisis no tiene el formato esperado.');
  }
  if (raw.ingredients.length === 0) {
    throw new ScannerError('invalid-response', 'No se detectó ningún alimento en la imagen.');
  }

  const ingredients = raw.ingredients.slice(0, MAX_INGREDIENTS).map((item): ScanIngredient => {
    if (!isRecord(item)) throw new ScannerError('invalid-response', 'Ingrediente con formato no válido.');
    const name = readText(item.name, 80);
    if (!name) throw new ScannerError('invalid-response', 'Ingrediente sin nombre.');
    const grams = readNumber(item, 'grams', 3000, true) as number;
    const category = categories.includes(item.category as ScanCategory) ? (item.category as ScanCategory) : 'ingrediente';
    const gramsMin = readNumber(item, 'gramsMin', 3000, false);
    const gramsMax = readNumber(item, 'gramsMax', 3000, false);
    const confidence = readNumber(item, 'confidence', 1, false);
    return {
      name,
      category,
      cooking: readText(item.cooking, 40),
      grams,
      gramsMin: gramsMin !== undefined ? Math.min(gramsMin, grams) : undefined,
      gramsMax: gramsMax !== undefined ? Math.max(gramsMax, grams) : undefined,
      calories: readNumber(item, 'calories', 5000, true) as number,
      protein: readNumber(item, 'protein', 500, true) as number,
      carbohydrates: readNumber(item, 'carbohydrates', 800, true) as number,
      fat: readNumber(item, 'fat', 500, true) as number,
      fiber: readNumber(item, 'fiber', 200, false),
      confidence,
    };
  });

  const notes = Array.isArray(raw.notes) ? raw.notes.map((note) => readText(note, 200)).filter((note): note is string => Boolean(note)).slice(0, 6) : [];
  return { dishName: readText(raw.dishName, 80), ingredients, notes, provider: readText(raw.provider, 40) };
}

/** Margen genérico cuando el modelo no aporta intervalo: la foto no permite conocer el peso exacto. */
const genericMargin = (category: ScanCategory) => (category === 'aceite' || category === 'salsa' ? { low: 0.5, high: 1.5 } : { low: 0.75, high: 1.25 });

export type ScanTotals = { total: Macros; min: Macros; max: Macros; usesGenericMargin: boolean };

function scaleIngredient(ingredient: ScanIngredient, factor: number): Macros {
  return {
    calories: ingredient.calories * factor,
    protein: ingredient.protein * factor,
    carbohydrates: ingredient.carbohydrates * factor,
    fat: ingredient.fat * factor,
    fiber: (ingredient.fiber ?? 0) * factor,
  };
}

export function scanTotals(ingredients: ScanIngredient[]): ScanTotals {
  let total = emptyMacros();
  let min = emptyMacros();
  let max = emptyMacros();
  let usesGenericMargin = false;
  for (const ingredient of ingredients) {
    const margin = genericMargin(ingredient.category);
    const hasRange = ingredient.gramsMin !== undefined && ingredient.gramsMax !== undefined && ingredient.grams > 0;
    if (!hasRange) usesGenericMargin = true;
    const lowFactor = hasRange ? (ingredient.gramsMin as number) / ingredient.grams : margin.low;
    const highFactor = hasRange ? (ingredient.gramsMax as number) / ingredient.grams : margin.high;
    total = addMacros(total, scaleIngredient(ingredient, 1));
    min = addMacros(min, scaleIngredient(ingredient, lowFactor));
    max = addMacros(max, scaleIngredient(ingredient, highFactor));
  }
  return { total, min, max, usesGenericMargin };
}

/** Cambia los gramos de un ingrediente manteniendo la densidad nutricional estimada. */
export function rescaleIngredient(ingredient: ScanIngredient, grams: number): ScanIngredient {
  const safeGrams = Math.max(0, grams);
  if (ingredient.grams <= 0) return { ...ingredient, grams: safeGrams };
  const factor = safeGrams / ingredient.grams;
  return {
    ...ingredient,
    grams: safeGrams,
    gramsMin: ingredient.gramsMin !== undefined ? round1(ingredient.gramsMin * factor) : undefined,
    gramsMax: ingredient.gramsMax !== undefined ? round1(ingredient.gramsMax * factor) : undefined,
    calories: round1(ingredient.calories * factor),
    protein: round1(ingredient.protein * factor),
    carbohydrates: round1(ingredient.carbohydrates * factor),
    fat: round1(ingredient.fat * factor),
    fiber: ingredient.fiber !== undefined ? round1(ingredient.fiber * factor) : undefined,
  };
}

type HttpProviderOptions = {
  url: string;
  getToken?: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
};

export function createHttpScannerProvider(options: HttpProviderOptions): FoodScannerProvider {
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  return {
    id: 'http',
    async analyze(image, signal) {
      const token = options.getToken ? await options.getToken() : null;
      let response: Response;
      try {
        response = await fetchImpl(options.url, {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ image: image.base64, mimeType: image.mimeType, locale: 'es' }),
        });
      } catch {
        throw new ScannerError('network', 'No se pudo conectar con el servicio de análisis. Revisa tu conexión.');
      }
      if (response.status === 401 || response.status === 403) throw new ScannerError('unauthorized', 'Inicia sesión en la nube para usar el análisis de imágenes.');
      if (response.status === 413) throw new ScannerError('too-large', 'La imagen es demasiado grande.');
      if (response.status === 429) throw new ScannerError('rate-limited', 'Has alcanzado el límite de análisis. Inténtalo más tarde.');
      if (!response.ok) throw new ScannerError('server', 'El servicio de análisis no está disponible ahora mismo.');
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new ScannerError('invalid-response', 'La respuesta del análisis no es válida.');
      }
      return parseScanResult(payload);
    },
  };
}
