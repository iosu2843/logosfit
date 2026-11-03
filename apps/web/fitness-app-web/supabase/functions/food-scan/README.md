# food-scan (Edge Function)

Backend del **Food Scanner AI**. Recibe una imagen, la envía a un modelo de visión y devuelve JSON con los ingredientes estimados. La clave del proveedor de IA solo existe aquí.

## Despliegue

```bash
supabase login
supabase link --project-ref <tu-project-ref>
supabase secrets set AI_API_KEY=<clave> AI_MODEL=gpt-4o-mini
# opcionales: AI_BASE_URL (por defecto https://api.openai.com/v1), ALLOWED_ORIGIN=https://iosu2843.github.io
supabase functions deploy food-scan
```

La función exige un JWT de Supabase (usuario con sesión). Después, define en el frontend:

```
VITE_FOOD_SCANNER_URL=https://<project-ref>.supabase.co/functions/v1/food-scan
```

(en `.env.local` y como secreto/variable de GitHub Actions para el despliegue).

## Cambiar de proveedor

Mientras la API sea compatible con `chat/completions` con visión, basta con cambiar `AI_BASE_URL`, `AI_MODEL` y `AI_API_KEY`. Para otros formatos, sustituye la llamada en `index.ts`: el cliente solo depende del JSON de respuesta (validado en `src/nutrition/scanner.ts`).
