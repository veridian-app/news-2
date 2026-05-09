import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_KEY = process.env.GEMINI_API_KEY;

export const maxDuration = 60; // Increase timeout to 60s for Gemini API

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { title, content } = req.body;
    if (!API_KEY) {
      return res.status(200).json({ 
        meaning: "ERROR: Clave de inteligencia no configurada.", 
        impact: "- Verifique las variables de entorno en Vercel (GEMINI_API_KEY)." 
      });
    }

    const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"];
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
            try {
              const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
              const parsed = JSON.parse(jsonString);
              return res.status(200).json(parsed);
            } catch (pErr) {
              return res.status(200).json({ 
                meaning: text.substring(0, 300), 
                impact: "- Error de descifrado en los satélites" 
              });
            }
          }
        } else {
          const errJson: any = await response.json().catch(() => ({}));
          lastError = errJson.error?.message || "Status: " + response.status;
        }
      } catch (e: any) {
        lastError = e.message;
      }
    }

    return res.status(200).json({ 
      meaning: "SISTEMA SATURADO: El satélite de análisis ha alcanzado su cuota táctica.", 
      impact: "- Intente de nuevo en unos segundos. - El sistema está operando en modo de baja latencia." 
    });
  } catch (globalErr: any) {
    return res.status(200).json({ 
      meaning: "FALLO CRÍTICO: Error en el núcleo de inteligencia.", 
      impact: "- Contacte con el soporte técnico de Veridian. - Detalle: " + globalErr.message 
    });
  }
}
