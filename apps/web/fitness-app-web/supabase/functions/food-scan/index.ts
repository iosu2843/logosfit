// Edge Function de Supabase: analiza una foto de un plato con un modelo de visión.
// La clave del proveedor vive solo aquí (secretos de Supabase). El cliente nunca la ve.
//
// Proveedor intercambiable: cualquier API compatible con "chat/completions" con visión
// (OpenAI, Azure OpenAI, OpenRouter, servidores propios...). Se configura con variables de entorno.

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const MAX_BASE64_LENGTH = 8_000_000;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const systemPrompt = `Eres un asistente de nutrición que estima el contenido de un plato a partir de una fotografía.
Responde SOLO con un objeto JSON con esta forma:
{
  "dishName": string,
  "ingredients": [
    {
      "name": string,
      "category": "ingrediente" | "salsa" | "aceite" | "acompañamiento",
      "cooking": string | null,
      "grams": number,
      "gramsMin": number,
      "gramsMax": number,
      "calories": number,
      "protein": number,
      "carbohydrates": number,
      "fat": number,
      "fiber": number,
      "confidence": number
    }
  ],
  "notes": string[]
}
Reglas:
- Los valores nutricionales corresponden a la cantidad "grams" estimada de cada ingrediente, no a 100 g.
- Una foto no permite conocer el peso real, los ingredientes ocultos ni el aceite usado: da siempre un intervalo realista (gramsMin, gramsMax) y baja "confidence" (0 a 1) cuando dudes.
- Incluye salsas, aceites y acompañamientos visibles. Si sospechas aceite o salsa no visibles, menciónalo en "notes".
- No inventes alimentos que no veas. Si la imagen no contiene comida, devuelve "ingredients": [].
- Escribe nombres y notas en español.`;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const apiKey = Deno.env.get('AI_API_KEY');
  if (!apiKey) return json({ error: 'not-configured' }, 503);

  let body: { image?: unknown; mimeType?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid-json' }, 400);
  }
  const image = typeof body.image === 'string' ? body.image : '';
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : '';
  if (!image || !ALLOWED_TYPES.includes(mimeType)) return json({ error: 'invalid-image' }, 400);
  if (image.length > MAX_BASE64_LENGTH) return json({ error: 'too-large' }, 413);

  const baseUrl = (Deno.env.get('AI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini';

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analiza este plato y estima su contenido nutricional.' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image}` } },
          ],
        },
      ],
    }),
  });

  if (upstream.status === 429) return json({ error: 'rate-limited' }, 429);
  if (!upstream.ok) return json({ error: 'upstream-error' }, 502);

  try {
    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(typeof content === 'string' ? content : '{}');
    return json({ ...parsed, provider: model });
  } catch {
    return json({ error: 'invalid-model-output' }, 502);
  }
});
