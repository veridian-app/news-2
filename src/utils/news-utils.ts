// News processing utilities for Veridian Systems
import { NewsItem } from "@/types/news";

// Helper to normalize categories (quitar acentos, mayúsculas y mapear sinónimos)
export const normalizeCategory = (cat: string): string => {
  if (!cat) return 'GEOPOLÍTICA';
  const normalized = cat.toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  
  // Mapeo táctico total a las 6 categorías maestras
  if (normalized === 'TODO' || normalized === 'ALL') return 'TODO';
  if (normalized === 'TECH' || normalized === 'INNOVACION' || normalized === 'TECNOLOGIA' || normalized === 'CIENCIA') return 'TECH';
  if (normalized === 'ESPANA' || normalized === 'NACIONAL' || normalized === 'SPAIN') return 'ESPAÑA';
  if (normalized === 'INTERNACIONAL' || normalized === 'MUNDO' || normalized === 'GLOBAL' || normalized === 'GENERAL' || normalized === 'NEWS' || normalized === 'NOTICIAS') return 'INTERNACIONAL';
  if (normalized === 'POLITICA' || normalized === 'GOBIERNO' || normalized === 'ELECCIONES') return 'POLÍTICA';
  if (normalized === 'DEPORTES' || normalized === 'SPORT' || normalized === 'FUTBOL' || normalized === 'TENIS' || normalized === 'BALONCESTO') return 'DEPORTES';
  if (normalized === 'GEOPOLITICA' || normalized === 'CONFLICTOS' || normalized === 'GUERRA') return 'GEOPOLÍTICA';

  // Fallback si no encaja en ninguna
  return 'INTERNACIONAL';
};

// Detectar categoría táctica
export const detectCategory = (title: string, content?: string): string => {
  const normalizeText = (text: string) => 
    text.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

  const textToAnalyze = normalizeText(`${title} ${content || ''}`);
  const matches = (keywords: string) => {
    const normalizedKeywords = normalizeText(keywords);
    const regex = new RegExp(`\\b(${normalizedKeywords})\\b`, 'i');
    return regex.test(textToAnalyze);
  };

  if (matches('ucrania|rusia|otan|gaza|israel|iran|geopolitica|guerra|conflicto|misil|onu|unicef|interpol|diplomacia|eeuu|china|taiwan|zelensky|putin|biden|kremlin|pentagono')) return 'GEOPOLÍTICA';
  if (matches('madrid|barcelona|valencia|andalucia|espana|nacional|español|española|rey|felipe|letizia|zarzuela')) return 'ESPAÑA';
  if (matches('politica|gobierno|ley|partido|sanchez|moncloa|congreso|pp|psoe|vox|sumar|ayuso|feijoo|elecciones|diputados|senado')) return 'POLÍTICA';
  if (matches('internacional|mundo|global|extranjero|macron|scholz|europa|latinoamerica|mexico|argentina|venezuela|colombia')) return 'INTERNACIONAL';
  if (matches('tecnologia|tech|ia|software|hardware|apple|google|microsoft|startup|ciberseguridad|iphone|meta|elon musk|x|twitter')) return 'TECH';
  if (matches('deportes|futbol|tenis|baloncesto|nba|champions|liga|real madrid|barça|alcaraz|nadal|alonso|formula 1|olimpicos')) return 'DEPORTES';
  
  return 'INTERNACIONAL';
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

    if (item.content && item.content.length > 100) score += 0.5;
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
