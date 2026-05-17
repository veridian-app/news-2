// News processing utilities for Veridian Systems
import { NewsItem } from "@/types/news";
import Fuse from "../lib/vendor/fuse-vendor.mjs";

// Helper to normalize categories (quitar acentos, mayúsculas y mapear sinónimos)
export const normalizeCategory = (cat: string): string => {
  if (!cat) return 'GEOPOLÍTICA';
  const normalized = cat.toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  
  // Mapeo táctico total a las 6 categorías maestras
  if (normalized === 'TODO' || normalized === 'ALL') return 'TODO';
  if (normalized === 'TECH' || normalized === 'INNOVACION' || normalized === 'TECNOLOGIA' || normalized === 'CIENCIA' || normalized === 'DIGITAL' || normalized === 'IA' || normalized === 'AI') return 'TECH';
  if (normalized === 'ESPANA' || normalized === 'NACIONAL' || normalized === 'SPAIN' || normalized === 'MADRID' || normalized === 'LOCAL') return 'ESPAÑA';
  if (normalized === 'INTERNACIONAL' || normalized === 'MUNDO' || normalized === 'GLOBAL' || normalized === 'GENERAL' || normalized === 'NEWS' || normalized === 'NOTICIAS' || normalized === 'SOCIEDAD' || normalized === 'CULTURA') return 'INTERNACIONAL';
  if (normalized === 'POLITICA' || normalized === 'GOBIERNO' || normalized === 'ELECCIONES' || normalized === 'PARLAMENTO' || normalized === 'CONGRESO') return 'POLÍTICA';
  if (normalized === 'DEPORTES' || normalized === 'SPORT' || normalized === 'FUTBOL' || normalized === 'TENIS' || normalized === 'BALONCESTO' || normalized === 'MOTOR') return 'DEPORTES';
  if (normalized === 'GEOPOLITICA' || normalized === 'CONFLICTOS' || normalized === 'GUERRA' || normalized === 'DEFENSA' || normalized === 'MILITAR' || normalized === 'DIPLOMACIA') return 'GEOPOLÍTICA';

  // Fallback si no encaja en ninguna
  return 'INTERNACIONAL';
};

// Detectar categoría táctica con alta precisión
// Detectar categoría táctica con alta precisión mediante sistema de scoring jerárquico
export const detectCategory = (title: any, content?: any): string => {
  const safeTitle = typeof title === 'string' ? title : String(title || '');
  const safeContent = typeof content === 'string' ? content : String(content || '');

  const normalizeTextLocal = (text: string) => 
    text.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

  const normTitle = normalizeTextLocal(safeTitle);
  const normContent = normalizeTextLocal(safeContent);
  const fullText = `${normTitle} ${normContent}`;

  const countMatches = (keywords: string, text: string) => {
    const list = keywords.split('|').map(k => k.trim()).filter(Boolean);
    let count = 0;
    for (const kw of list) {
      const regex = new RegExp(`\\b${normalizeTextLocal(kw)}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        count += matches.length;
      }
    }
    return count;
  };

  const categoriesDict = {
    GEOPOLÍTICA: {
      strong: 'ucrania|rusia|otan|gaza|israel|iran|geopolitica|guerra civil|conflicto armado|misil balistico|onu|unicef|interpol|diplomacia|taiwan|zelensky|putin|biden|kremlin|pentagono|ejercito|invasion militar|armas nucleares|geoeconomia|hamas|hezbola|palestina|kiev|moscu',
      ambiguous: 'guerra|conflicto|misil|defensa|militar|armamento|invasion|frontera|nuclear|sanciones|inteligencia|pacto|alianza|tratado'
    },
    DEPORTES: {
      strong: 'futbol|tenis|baloncesto|nba|champions|liga|laliga|uefa|fifa|acb|f1|formula 1|motogp|juegos olimpicos|mundial de futbol|eurocopa|copa del rey|copa america|libertadores|betis|real madrid|barça|fc barcelona|atletico de madrid|atleti|girona fc|athletic club|villarreal cf|real sociedad|mbappe|vinicius|bellingham|lewandowski|alcaraz|nadal|alonso|sainz|ciclismo|tour de francia|vuelta a españa|padel|boxeo|ufc|mma|atletismo|natacion|goleador|penalti|var|arbitro|hat-trick|doblete|goleada|tie-break|break point|rebound',
      ambiguous: 'deportes|sport|victoria|derrota|fichaje|traspaso|marcador|entrenador|vencer|triunfo|gol|balon|pelota|estadio|pista|torneo|medalla|podio|clasificacion|permanencia|descenso|ascenso|playoff|eliminatoria|semifinal|finalista|cuartos|octavos|remontada|asistencia|falta|tarjeta|corner|set|triple|mate'
    },
    TECH: {
      strong: 'tecnologia|software|hardware|apple|google|microsoft|startup|ciberseguridad|iphone|openai|chatgpt|gemini|nvidia|bitcoin|crypto|criptomonedas|blockchain|semiconductores|chips|biotech|robotica|espacial|nasa|spacex|tesla|quantum|inteligencia artificial|ia|algoritmo|ciberataque|ransomware|metaverso|realidad virtual',
      ambiguous: 'digital|innovacion|ciencia|redes sociales|plataforma|usuario|datos|nube|servidor|aplicacion|app'
    },
    ESPAÑA: {
      strong: 'madrid|barcelona|valencia|andalucia|zarzuela|generalitat|pais vasco|euskadi|galicia|canarias|alicante|sevilla|malaga|zaragoza|bilbao|comunidad de madrid|junta de andalucia|mossos|guardia civil|policia nacional|psoe andalucia|pp madrid',
      ambiguous: 'espana|nacional|español|española|rey|felipe|letizia|comunidad|senado|congreso|diputados|moncloa'
    },
    POLÍTICA: {
      strong: 'politica|sanchez|moncloa|pp|psoe|vox|sumar|ayuso|feijoo|elecciones generales|parlamento|ministro|alcalde|legislatura|reforma laboral|ley de amnistia|constitucional|tribunal supremo|audiencia nacional|decreto|votacion|investidura|mencion de censura',
      ambiguous: 'gobierno|ley|partido|diputados|senado|concejal|voto|reforma|justicia|juez|fiscal|tribunal|pacto|acuerdo|negociacion|oposicion|debate'
    },
    INTERNACIONAL: {
      strong: 'macron|scholz|latinoamerica|mexico|argentina|venezuela|colombia|eeuu|usa|africa|asia|pacifico|union europea|comision europea|brexit|trump|kamala|harris|washington|londres|parís|berlin|tokio|pekin',
      ambiguous: 'internacional|mundo|global|extranjero|europa|migracion|clima|salud|oms|pandemia|crisis global|cumbre'
    }
  };

  const scores: Record<string, number> = {
    GEOPOLÍTICA: 0,
    DEPORTES: 0,
    TECH: 0,
    ESPAÑA: 0,
    POLÍTICA: 0,
    INTERNACIONAL: 0
  };

  for (const [cat, dict] of Object.entries(categoriesDict)) {
    const titleStrong = countMatches(dict.strong, normTitle);
    const titleAmb = countMatches(dict.ambiguous, normTitle);
    const contentStrong = countMatches(dict.strong, normContent);
    const contentAmb = countMatches(dict.ambiguous, normContent);

    scores[cat] = (titleStrong * 5) + (contentStrong * 2) + (titleAmb * 2) + (contentAmb * 1);
  }

  if (countMatches(categoriesDict.DEPORTES.strong, fullText) > 0) {
    scores.DEPORTES += 10;
    scores.GEOPOLÍTICA = Math.max(0, scores.GEOPOLÍTICA - 10);
  }

  if (countMatches(categoriesDict.POLÍTICA.strong, fullText) > 0 || countMatches(categoriesDict.ESPAÑA.strong, fullText) > 0) {
    scores.POLÍTICA += 5;
    scores.DEPORTES = Math.max(0, scores.DEPORTES - 8);
  }

  let bestCategory = 'INTERNACIONAL';
  let maxScore = 0;

  for (const [cat, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = cat;
    }
  }

  if (maxScore < 2) {
    return 'INTERNACIONAL';
  }

  return bestCategory;
};

// Shuffle news
export const shuffleNews = (newsArray: any[]) => {
  const shuffled = [...newsArray];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Recommendation algorithm
export const recommendNews = (newsArray: any[], preferences: Map<string, number>, likedIds: Set<string>): any[] => {
  if (preferences.size === 0 && likedIds.size === 0) {
    const sortedByLikes = [...newsArray].sort((a, b) => (b.likes || 0) - (a.likes || 0));
    const topLiked = sortedByLikes.slice(0, Math.min(5, sortedByLikes.length));
    const rest = shuffleNews(sortedByLikes.slice(5));
    return [...topLiked, ...rest];
  }

  const maxPreferenceScore = Math.max(...Array.from(preferences.values()), 1);

  const scoredNews = newsArray.map(item => {
    let score = 0;
    const category = item.category || detectCategory(item.title || '', item.content || '');
    const source = item.source || '';

    const categoryScore = preferences.get(category) || 0;
    const normalizedCategoryScore = maxPreferenceScore > 0 ? (categoryScore / maxPreferenceScore) * 10 : 0;
    score += normalizedCategoryScore * 4;

    const sourceScore = preferences.get(`source:${source}`) || 0;
    const normalizedSourceScore = maxPreferenceScore > 0 ? (sourceScore / maxPreferenceScore) * 10 : 0;
    score += normalizedSourceScore * 2;

    const likesCount = item.likes || 0;
    if (likesCount > 0) {
      const likesBonus = Math.log10(1 + likesCount) * 1.5;
      score += likesBonus;
    }

    if (likedIds.has(item.id)) {
      score -= 20;
    }

    try {
      const newsDate = new Date(item.date || Date.now());
      const daysSincePublication = (Date.now() - newsDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePublication < 0.5) score += 3;
      else if (daysSincePublication < 1) score += 2.5;
      else if (daysSincePublication < 3) score += 2;
      else if (daysSincePublication < 7) score += 1;
      else if (daysSincePublication < 30) score += 0.5;
    } catch (e) {}

    if (item.content && typeof item.content === 'string' && item.content.length > 100) score += 0.5;
    if (item.url) score += 0.3;

    return { item, score };
  });

  scoredNews.sort((a, b) => {
    if (Math.abs(a.score - b.score) < 0.5) {
      return Math.random() > 0.5 ? -1 : 1;
    }
    return b.score - a.score;
  });

  const veryRecommended = scoredNews.filter(n => n.score > 8).map(n => n.item);
  const recommended = scoredNews.filter(n => n.score > 2 && n.score <= 8).map(n => n.item);
  const rest = scoredNews.filter(n => n.score <= 2).map(n => n.item);

  const shuffledRecommended = shuffleNews(recommended);
  const shuffledRest = shuffleNews(rest);

  const varietyFromRest = shuffledRest.slice(0, Math.min(3, shuffledRest.length));
  const remainingRest = shuffledRest.slice(3);

  return [...veryRecommended, ...varietyFromRest, ...shuffledRecommended, ...remainingRest];
};

/**
 * Extrae puntos clave de un texto de forma táctica para el feed de Veridian.
 * Intenta obtener las oraciones más significativas y las formatea como bullets.
 * Tolerante a fallos si text no es un string válido.
 */
export const extractKeyPoints = (text: any): string[] => {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return ['Información no disponible', 'Contenido pendiente', 'Datos en actualización'];
  }

  // Dividir el texto en oraciones
  const sentences = text
    .split(/[.!?]\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 250); 

  if (sentences.length === 0) {
    const parts = text.split(/[,;]\s+/).filter(p => p.length > 15);
    return parts.slice(0, 3).map(p => p.trim());
  }

  // Seleccionar las oraciones más informativas
  const sortedSentences = sentences
    .sort((a, b) => b.length - a.length)
    .slice(0, 5)
    .map(s => {
      let cleaned = s.replace(/^\d+[\.\)]\s*/, ''); 
      cleaned = cleaned.replace(/^[-•]\s*/, ''); 
      cleaned = cleaned.trim();
      if (!cleaned.match(/[.!?]$/)) {
        cleaned += '.';
      }
      return cleaned;
    });

  // Asegurar que siempre haya al menos 3 puntos
  const result = sortedSentences.slice(0, 3);
  while (result.length < 3) {
    result.push('Información adicional disponible en la fuente.');
  }

  return result;
};

/**
 * Normaliza texto para comparaciones tácticas (quitar acentos, etc)
 */
export const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

/**
 * Realiza una búsqueda táctica de alta precisión usando Fuse.js
 */
export const searchNews = (newsArray: NewsItem[], query: string): NewsItem[] => {
  if (!query || !query.trim()) return newsArray;

  const normalizedQuery = normalizeText(query);

  const options = {
    keys: [
      { name: 'title', weight: 3.0 },
      { name: 'category', weight: 2.0 },
      { name: 'summary', weight: 1.5 },
      { name: 'content', weight: 1.0 },
      { name: 'source', weight: 0.5 },
      { name: 'analysis', weight: 0.8 }
    ],
    threshold: 0.6, // Más permisivo para encontrar más artículos relacionados
    distance: 1000, // Aumentado para buscar coincidencias más lejanas en el texto
    ignoreLocation: true,
    useExtendedSearch: true,
    minMatchCharLength: 2,
    getFn: (obj: any, key: string | string[]) => {
      const value = obj[key as string];
      if (typeof value === 'string') {
        return normalizeText(value);
      }
      return value;
    }
  };

  const fuse = new Fuse(newsArray, options);
  const results = fuse.search(normalizedQuery);
  
  return results.map(result => result.item);
};
