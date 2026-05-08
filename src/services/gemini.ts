import { GoogleGenerativeAI } from "@google/generative-ai";

export interface NewsAnalysis {
  meaning: string;
  impact: string;
}

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const analyzeNews = async (title: string, content: string): Promise<NewsAnalysis> => {
  let technicalDetails = "";

  // 1. Intentar vía Servidor (Nueva Generación)
  try {
    const response = await fetch('/api/analyze-news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });

    if (response.ok) {
      const data: any = await response.json();
      if (data.error) {
        throw new Error(data.message || "Fallo en API Proxy");
      }
      return data as NewsAnalysis;
    }
    const errData = await response.json().catch(() => ({}));
    technicalDetails += `[Server: ${response.status} ${errData.error || ''}] `;
  } catch (e: any) {
    technicalDetails += `[Server: ConnError ${e.message}] `;
  }

  // 2. Fallback: Enlace Directo (Modelos 2.0 y Superiores)
  if (!API_KEY) {
    return {
      meaning: "ERROR: Clave de inteligencia no encontrada.",
      impact: "Verifica el archivo .env"
    };
  }

  // LISTA DE MODELOS DE NUEVA GENERACIÓN (Basada en tus permisos reales)
  const modelsToTry = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-2.5-flash", "gemini-pro-latest"];
  
  for (const modelName of modelsToTry) {
    try {
      console.log(`[INTEL] Enlace directo de Nueva Generación: ${modelName}`);
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
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
          return JSON.parse(jsonString) as NewsAnalysis;
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        technicalDetails += `[Direct-${modelName}: ${response.status} ${errJson.error?.message || ''}] `;
      }
    } catch (error: any) {
      technicalDetails += `[Direct-${modelName}: ${error.message}] `;
    }
  }

  return {
    meaning: "FALLO DE COMUNICACIONES DE NUEVA GENERACIÓN. Detalles: " + technicalDetails,
    impact: "El satélite 2.0 no responde. Verifica permisos en Google AI Studio."
  };
};
