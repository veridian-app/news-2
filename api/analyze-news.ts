import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_KEY = process.env.GEMINI_API_KEY;

export const maxDuration = 60; // Increase timeout to 60s for Gemini API

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, content } = req.body;
  if (!API_KEY) return res.status(200).json({ error: true, message: 'GEMINI_API_KEY no configurada' });

  // LISTA DE MODELOS DE NUEVA GENERACIÓN (Basada en tus permisos reales)
  const models = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-2.5-flash", "gemini-pro-latest"];
  let lastError = "";

  for (const modelName of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `
              Eres un analista de inteligencia táctica de Veridian Systems.
              REGLA DE ORO: Tus respuestas deben ser EXTREMADAMENTE CONCISAS, DIRECTAS Y AL GRANO.
              Cero texto de relleno (prohibido usar "La noticia describe...", "En resumen...").
              
              Responde SOLO con este JSON puro:
              { 
                "meaning": "Explicación directa en 2 o 3 frases cortas de máximo impacto.", 
                "impact": "Usa 3 viñetas breves (- Punto 1...) con las consecuencias críticas reales." 
              }
              
              TÍTULO: ${title}
              CONTENIDO: ${content}
            ` }] }]
          })
        }
      );

      if (response.ok) {
        const data: any = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
          return res.status(200).json(JSON.parse(jsonString));
        }
      } else {
        const errJson: any = await response.json().catch(() => ({}));
        // If it's a rate limit (429), maybe wait and try another model? It will just go to next loop.
        lastError = `[${modelName}: ${response.status} ${errJson.error?.message || ''}]`;
      }
    } catch (e: any) {
      lastError = `[${modelName}: ${e.message}]`;
    }
  }

  // Devolver 200 con formato de error para que el navegador no marque la consola en rojo
  return res.status(200).json({ error: true, message: 'Fallo total en satélites de nueva generación', details: lastError });
}
