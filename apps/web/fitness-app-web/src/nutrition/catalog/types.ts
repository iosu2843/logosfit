/** Fila compacta por 100 g (o 100 ml): nombre, kcal, proteína, carbohidratos, grasa, fibra, unidad. */
export type CatalogRow = [name: string, calories: number, protein: number, carbohydrates: number, fat: number, fiber: number, unit?: 'g' | 'ml'];

export type CatalogSection = { category: string; rows: CatalogRow[] };
