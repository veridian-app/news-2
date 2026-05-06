import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { NewsImage } from "../components/NewsImage";
import "./VeridianNews.css";
import { supabase, isSupabaseConfigured } from "../integrations/supabase/client";
import { useIsMobile, useScreenSize } from "../hooks/use-mobile";
import { Clock, Brain, ThumbsUp, ThumbsDown, X, ExternalLink, Search, Globe, Star, MessageSquare, User, Shield, LogOut, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BottomDock } from "../components/BottomDock";
import { NewsCard } from "@/components/NewsCard";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSearch } from "@/contexts/SearchContext";
import { analyzeNews } from "../services/gemini";
import { NewsItem } from "@/types/news";
import { normalizeCategory, detectCategory, shuffleNews, recommendNews } from "@/utils/news-utils";


// Sanitize API_BASE: force relative path in production to avoid CORS/loopback issues
const getApiBase = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return ''; // Force relative in production regardless of env vars
    }
  }
  return import.meta.env.VITE_VERIDIAN_API_BASE || '';
};
const API_BASE = getApiBase();

// Legacy fingerprint function - kept for backwards compatibility but now we use Supabase Auth
const getOrCreateUserId = (): string => {
  // This is now just a fallback - the real user ID comes from useAuth
  let userId = localStorage.getItem('veridian_userId');
  if (!userId) {
    userId = `anon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('veridian_userId', userId);
  }
  return userId;
};

// Fallback for non-authenticated context (shouldn't happen with ProtectedRoute)
const FALLBACK_USER_ID = getOrCreateUserId();

const VeridianNews = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const screenSize = useScreenSize();
  const { toast: toastShadcn } = useToast();
  const { user, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Use authenticated user ID, fallback to anonymous ID for backwards compatibility
  const USER_ID = user?.id || FALLBACK_USER_ID;


  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('INICIALIZANDO_TERMINAL...');
  const [error, setError] = useState<string | null>(null);
  const [tableExists, setTableExists] = useState<boolean | null>(null);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [showContentModal, setShowContentModal] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{ meaning: string; impact: string } | null>(null);
  const [analysisCache, setAnalysisCache] = useState<Record<string, { meaning: string; impact: string }>>({});
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [currentVisibleNews, setCurrentVisibleNews] = useState<NewsItem | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [likedNewsIds, setLikedNewsIds] = useState<Set<string>>(new Set());
  const [userPreferences, setUserPreferences] = useState<Map<string, number>>(new Map());
  // Inicializar vacío - solo mostrar noticias del Excel
  const [rawNews, setRawNews] = useState<NewsItem[]>([]); // Noticias sin ordenar - solo del Excel
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const loadingProgressRef = useRef<HTMLDivElement>(null);
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [sortBy, setSortBy] = useState<'recommended' | 'recent'>('recommended');
  const [activeCategory, setActiveCategory] = useState<string>('TODO');

  // Búsqueda desde contexto compartido
  const { searchQuery, setSearchQuery, showSearchModal, closeSearch } = useSearch();

  // Debounced search query para evitar colapso de UI
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Onboarding & Feedback
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');

  // Calcular noticias recomendadas basándose en preferencias y búsqueda
  const news = useMemo(() => {
    console.log('📰 Calculando noticias, rawNews.length:', rawNews.length);
    // Solo usar noticias del Excel, no usar mockNews
    if (rawNews.length === 0) {
      console.log('⚠️ No hay noticias del Excel disponibles');
      return [];
    }

    // Primero filtrar por búsqueda si hay query (usando debounced para performance)
    let filteredNews = rawNews;
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filteredNews = rawNews.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.summary?.toLowerCase().includes(query) ||
        item.source?.toLowerCase().includes(query) ||
        item.content?.toLowerCase().includes(query)
      );
      console.log(`🔍 Búsqueda "${debouncedSearchQuery}": ${filteredNews.length} resultados`);
    }

    // Si el usuario elige "Recientes", forzar orden cronológico
    if (sortBy === 'recent') {
      console.log('📅 Ordenando por fecha (Recientes)');
      return [...filteredNews].sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    }

    if (userPreferences.size === 0) {
      const shuffled = shuffleNews([...filteredNews]);
      console.log('✅ Noticias mezcladas:', shuffled.length);
      return shuffled;
    }
    const recommended = recommendNews([...filteredNews], userPreferences, likedNewsIds);
    console.log('✅ Noticias recomendadas:', recommended.length);
    return recommended;
  }, [rawNews, userPreferences, likedNewsIds, sortBy, debouncedSearchQuery]);

  const categories = ['TODO', 'GEOPOLÍTICA', 'ESPAÑA', 'POLÍTICA', 'INTERNACIONAL', 'TECH', 'DEPORTES'];

  // Función de normalización para comparaciones robustas
  const normalize = (text: string) => 
    text.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

  // Solo mostrar noticias del Excel, no usar mockNews si hay reales
  const filteredNews = news && news.length > 0 ? news : [];
  
  const displayNews = useMemo(() => {
    const targetCat = normalizeCategory(activeCategory);
    
    if (targetCat === 'TODO') {
      return filteredNews;
    }

    return filteredNews.filter(n => {
      const itemCat = normalizeCategory(n.category || detectCategory(n.title, n.content));
      return itemCat === targetCat;
    });
  }, [filteredNews, activeCategory]);

  const marqueeText = displayNews.length > 0 
    ? displayNews.slice(0, 5).map(n => n.title).join(' • ').toUpperCase() 
    : 'ESPERANDO SEÑALES TÁCTICAS • CANAL SEGURO ACTIVO • BUSCANDO NOTICIAS DISPONIBLES';

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('veridian_onboarding_seen');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }

    const lastFeedbackDate = localStorage.getItem('veridian_last_feedback');
    const now = Date.now();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

    if (!lastFeedbackDate || now - parseInt(lastFeedbackDate) > THREE_DAYS) {
      setTimeout(() => setShowFeedback(true), 15000);
    }
  }, []);

  const handleCompleteOnboarding = () => {
    localStorage.setItem('veridian_onboarding_seen', 'true');
    setShowOnboarding(false);
  };

  // Auto-close onboarding after 4 seconds
  useEffect(() => {
    if (showOnboarding) {
      const timer = setTimeout(() => {
        handleCompleteOnboarding();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showOnboarding]);

  const handleSubmitFeedback = async () => {
    if (user?.id) {
        try {
            await (supabase as any).from('user_feedback').insert({ user_id: user.id, rating: feedbackRating, comment: feedbackText });
        } catch(e) { console.error(e); }
    }
    localStorage.setItem('veridian_last_feedback', Date.now().toString());
    setShowFeedback(false);
    toast.success("Feedback enviado", { description: "Gracias por ayudarnos a mejorar." });
  };
  
  const handleSkipFeedback = () => {
    localStorage.setItem('veridian_last_feedback', Date.now().toString());
    setShowFeedback(false);
  };


  // DEEP LINKING EFFECT
  useEffect(() => {
    const newsId = searchParams.get('newsId');
    // Esperar a que las noticias estén cargadas y el contenedor también
    if (newsId && news.length > 0 && feedContainerRef.current) {
      console.log('🔗 Deep link detectado para newsId:', newsId);

      const index = news.findIndex(n => n.id === newsId);

      if (index !== -1) {
        console.log(`✅ Noticia encontrada en índice ${index}, haciendo scroll...`);

        // Scroll inmediato al índice
        // Calculamos la posición basada en la altura de la ventana (100dvh)
        const scrollPosition = index * window.innerHeight;

        feedContainerRef.current.scrollTo({
          top: scrollPosition,
          behavior: 'instant' // Instantáneo para que parezca que carga ahí
        });

        setCurrentVisibleNews(news[index]);

        // Limpiar el parámetro de la URL
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('newsId');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [news, searchParams, setSearchParams]);

  useEffect(() => {
    if (isLoading) {
      const texts = [
        'CONECTANDO_CON_SATELLITE_LINK...',
        'DESCRIPTANDO_CANALES_NOTICIAS...',
        'FILTRANDO_RUIDO_GEOPOLITICO...',
        'SINCRONIZANDO_INTELIGENCIA...',
        'ACCESO_CONFIRMADO_NIVEL_9'
      ];
      let i = 0;
      const interval = setInterval(() => {
        setLoadingProgress(p => {
          if (p >= 100) {
            clearInterval(interval);
            return 100;
          }
          if (p % 20 === 0 && i < texts.length) {
            setLoadingText(texts[i]);
            i++;
          }
          return p + 2;
        });
      }, 40);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  useEffect(() => {
    // Intentar cargar desde la API en segundo plano
    const loadFromAPI = async () => {
      try {
        await loadNews();
      } catch (error) {
        console.error('Error cargando noticias desde API:', error);
      }
    };

    loadFromAPI();

    if (isSupabaseConfigured()) {
      try {
        loadUserLikes();
        loadUserPreferences();
      } catch (error) {
        console.error('Error cargando preferencias:', error);
      }
    }

    const interval = setInterval(() => {
      loadFromAPI();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Ref para el observer
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Efecto para IntersectionObserver
  useEffect(() => {
    const container = feedContainerRef.current;
    if (!container) return;

    // Limpiar observer anterior si existe
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Callback del observer
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Limpiar precargas pendientes si nos estamos moviendo
          if (prefetchTimeoutRef.current) {
            clearTimeout(prefetchTimeoutRef.current);
          }

          const index = Number(entry.target.getAttribute('data-index'));
          if (!isNaN(index) && displayNews[index]) {
            const currentNews = displayNews[index];
            setCurrentVisibleNews(currentNews);

            // 🧠 PRECARGA TÁCTICA INTELIGENTE: Esperar 1.5s de calma antes de pedir a la IA
            if (!analysisCache[currentNews.id]) {
              prefetchTimeoutRef.current = setTimeout(() => {
                const cleanSummary = (currentNews.summary || '').replace(/\.\.\.$/, '').trim();
                const cleanAnalysis = (currentNews.analysis || '').replace(/\.\.\.$/, '').trim();
                const textToAnalyze = (currentNews.content && currentNews.content !== 'Contenido restringido.') 
                  ? currentNews.content 
                  : `CONTEXTO_TÁCTICO: ${cleanAnalysis} | RESUMEN_ADICIONAL: ${cleanSummary}`;
                  
                analyzeNews(currentNews.title, textToAnalyze)
                  .then(analysis => {
                    setAnalysisCache(prev => ({ ...prev, [currentNews.id]: analysis }));
                  })
                  .catch(e => console.error("Fallo silencioso en precarga de satélite", e));
              }, 1500); // 1.5 segundos de margen táctico
            }

            // Preload next images logic
            const nextNews = displayNews[index + 1];
            if (nextNews && nextNews.image) {
              const img = new Image();
              img.src = nextNews.image;
            }
          }
        }
      });
    };

    // Crear nuevo observer
    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: container,
      threshold: 0.6, // La tarjeta debe estar al 60% visible
      rootMargin: "0px"
    });

    // Observar todas las tarjetas
    const cards = container.querySelectorAll('.news-card');
    cards.forEach((card) => {
      observerRef.current?.observe(card);
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [displayNews, isMobile, screenSize]); // Dependencias

  const openFullContent = async (item: NewsItem) => {
    setSelectedNews(item);
    setShowContentModal(true);
    
    // Intentar entrar en modo fullscreen
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    // ⚡ COMPROBACIÓN DE CACHÉ: Si ya lo analizamos en background, mostrar al instante
    if (analysisCache[item.id]) {
      setAiAnalysis(analysisCache[item.id]);
      setIsAiLoading(false);
      return;
    }

    // Si eres muy rápido y no ha dado tiempo a precargar, lo hacemos ahora
    setAiAnalysis(null);
    setIsAiLoading(true);

    try {
      const cleanSummary = (item.summary || '').replace(/\.\.\.$/, '').trim();
      const cleanAnalysis = (item.analysis || '').replace(/\.\.\.$/, '').trim();
      
      const textToAnalyze = (item.content && item.content !== 'Contenido restringido.') 
        ? item.content 
        : `CONTEXTO_TÁCTICO: ${cleanAnalysis} | RESUMEN_ADICIONAL: ${cleanSummary}`;
        
      const analysis = await analyzeNews(item.title, textToAnalyze);
      setAiAnalysis(analysis);
      // Guardar también en caché por si vuelve a entrar
      setAnalysisCache(prev => ({ ...prev, [item.id]: analysis }));
    } catch (err) {
      console.error("Error analizando noticia con IA:", err);
      setAiAnalysis({
        meaning: "Error en el enlace satelital. No se pudo procesar el significado.",
        impact: "Impacto no disponible. Verifica protocolos de red."
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const openAIChat = (item: NewsItem) => {
    toast("Próximamente", {
      description: "El asistente IA estará disponible muy pronto para responder tus dudas.",
    });
  };


  const updateLoadingProgress = (percent: number) => {
    if (loadingProgressRef.current) {
      loadingProgressRef.current.style.width = `${percent}%`;
    }
  };

  // Extraer 3 puntos clave del contenido/resumen
  const extractKeyPoints = (text: string): string[] => {
    if (!text || text.trim().length === 0) {
      return ['Información no disponible', 'Contenido pendiente', 'Datos en actualización'];
    }

    // Dividir el texto en oraciones
    const sentences = text
      .split(/[.!?]\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 200); // Filtrar oraciones muy cortas o muy largas

    if (sentences.length === 0) {
      // Si no hay oraciones válidas, dividir por comas o puntos
      const parts = text.split(/[,;]\s+/).filter(p => p.length > 15);
      return parts.slice(0, 3).map(p => p.trim());
    }

    // Seleccionar las 3 oraciones más informativas (las más largas y con más contenido)
    const sortedSentences = sentences
      .sort((a, b) => b.length - a.length)
      .slice(0, 3)
      .map(s => {
        // Limpiar y formatear
        let cleaned = s.replace(/^\d+[\.\)]\s*/, ''); // Eliminar numeración
        cleaned = cleaned.replace(/^[-•]\s*/, ''); // Eliminar bullets
        cleaned = cleaned.trim();
        // Asegurar que termine con punto si no lo tiene
        if (!cleaned.match(/[.!?]$/)) {
          cleaned += '.';
        }
        return cleaned;
      });

    // Si no hay suficientes oraciones, completar con partes del texto
    while (sortedSentences.length < 3 && text.length > 0) {
      const remaining = text.substring(
        sortedSentences.join(' ').length
      ).trim();
      if (remaining.length > 20) {
        const nextSentence = remaining.split(/[.!?]/)[0].trim();
        if (nextSentence.length > 20) {
          sortedSentences.push(nextSentence + '.');
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // Asegurar que siempre haya 3 puntos
    while (sortedSentences.length < 3) {
      sortedSentences.push('Información adicional disponible en la fuente.');
    }

    return sortedSentences.slice(0, 3);
  };

  const loadNews = async () => {
    // 1. Cargar caché inmediatamente si existe (Stale-While-Revalidate)
    const cachedNews = localStorage.getItem('veridian_news_cache');
    if (cachedNews) {
      try {
        const parsedCache = JSON.parse(cachedNews);
        if (Array.isArray(parsedCache) && parsedCache.length > 0) {
          console.log('📦 Cargando noticias desde caché local (instantáneo)');
          setRawNews(parsedCache);
          // No ponemos isLoading(false) aquí para mostrar indicador de "actualizando" si se desea,
          // o podemos ponerlo para que la UI esté lista ya.
          // Estrategia: Mostrar contenido ya, pero dejar el indicador de carga pequeño o invisible.
        }
      } catch (e) {
        console.error('Error parseando caché:', e);
      }
    } else {
      setIsLoading(true); // Solo mostrar loading full si no hay caché
      // Iniciar el progreso de carga artificial para el efecto cinematográfico
      setLoadingProgress(0);
    }

    setError(null);
    let newsData: NewsItem[] | null = null;

    try {
      updateLoadingProgress(10);

      // 1. Intentar cargar desde Supabase (Fuente principal)
      if (isSupabaseConfigured()) {
        try {
          console.log("🛰️ Iniciando protocolo de extracción desde Supabase...");
          
          const { data, error: supabaseError } = await (supabase as any)
            .from('daily_news')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200); // Aumentado para mayor cobertura

          if (supabaseError) {
            console.error("❌ Error en Supabase:", supabaseError);
            const { data: retryData } = await (supabase as any).from('daily_news').select('*').limit(100);
            if (retryData) newsData = processSupabaseData(retryData);
          } else if (data && data.length > 0) {
            newsData = processSupabaseData(data);
          }
        } catch (e) {
          console.error("Excepción en Supabase:", e);
        }
      }

      function processSupabaseData(data: any[]): NewsItem[] {
        return data.map(item => {
          const rawCat = item.category || item.Categories || item.metadata?.category;
          const category = rawCat ? normalizeCategory(rawCat) : detectCategory(item.title, item.content);
          
          // MEGA-CONTENT: Fusionar todos los campos para asegurar visión total
          const megaContent = [
            item.content && item.content !== 'Contenido restringido.' ? item.content : null,
            item.contexto_detallado || item.analysis || item.deep_analysis || item.contexto || null,
            item.summary || null
          ].filter(Boolean).join('\n\n');

          return {
            id: item.id || Math.random().toString(),
            title: item.title || 'SIN_TITULO',
            summary: item.summary || (megaContent ? megaContent.substring(0, 150) + '...' : 'Análisis táctico en proceso.'),
            content: megaContent || 'Contenido restringido.',
            image: item.image || item.image_url,
            date: item.published_at || item.created_at || new Date().toISOString(),
            source: item.source || 'VERIDIAN_INTEL',
            url: item.url,
            category: category,
            analysis: item.analysis || item.deep_analysis || item.contexto_detallado || item.metadata?.analysis
          };
        });
      }

      updateLoadingProgress(50);

      // 2. Si no hay datos de Supabase, intentar cargar del endpoint API (Fallback legacy)
      if (!newsData || newsData.length === 0) {
        try {
          const response = await fetch(`${API_BASE}/api/news?limit=100`, { 
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          if (response.ok) {
            const apiData = await response.json();
            if (Array.isArray(apiData)) newsData = apiData;
          }
        } catch (e) {
          console.error("Fallo en fallback API:", e);
        }
      }

      // 3. Confirmar y guardar datos
      if (newsData && newsData.length > 0) {
        setRawNews(newsData);
        localStorage.setItem('veridian_news_cache', JSON.stringify(newsData));
        setIsOffline(false);
        updateLoadingProgress(100);
      } else {
        throw new Error('Todas las fuentes de inteligencia están vacías.');
      }
    } catch (error: any) {
      console.error('❌ Error actualizando noticias:', error);
      setIsOffline(true);
      if (cachedNews) {
        console.log('⚠️ Usando versión en caché debido a error de red');
        toast.error("Sincronización Diferida", { 
          description: "No se pudo conectar con el servidor táctico. Usando datos locales guardados."
        });
      } else {
        setError('Error de enlace táctico. Verifica tu conexión o el estado del servidor.');
        setRawNews(mockNews);
      }
    } finally {
      setIsLoading(false);
      setRawNews(prev => (prev && prev.length > 0) ? prev : mockNews);
    }
  };

  // Cargar likes del usuario desde Supabase (userId anónimo) - SOLO funciona con Supabase
  const loadUserLikes = async () => {
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase no configurado. Los likes no se cargarán.');
      // Limpiar likes locales si Supabase no está configurado
      setLikedNewsIds(new Set());
      return;
    }
    try {
      const { data, error } = await supabase
        .from('news_likes')
        .select('news_id')
        .eq('user_id', USER_ID);

      if (error) {
        // Detectar si la tabla no existe o hay problema de schema cache
        const isTableNotFound = error.message && (
          error.message.includes('schema cache') ||
          error.message.includes('Could not find the table') ||
          error.message.includes('relation') && error.message.includes('does not exist')
        );

        if (isTableNotFound) {
          console.warn('⚠️ Error de schema cache detectado, intentando refrescar con delays más largos...');

          // Intentar múltiples veces con delays más largos (el schema cache puede tardar)
          for (let attempt = 1; attempt <= 5; attempt++) {
            const delay = attempt * 3000; // 3s, 6s, 9s, 12s, 15s
            console.log(`🔄 Intento ${attempt}/5: Esperando ${delay / 1000}s antes de reintentar...`);
            await new Promise(resolve => setTimeout(resolve, delay));

            // Reintentar la consulta
            const { data: retryData, error: retryError } = await supabase
              .from('news_likes')
              .select('news_id')
              .eq('user_id', USER_ID);

            if (!retryError && retryData !== null) {
              console.log('✅ Tabla encontrada después del reintento!');
              const likedIds = new Set(retryData.map(like => like.news_id));
              setLikedNewsIds(likedIds);
              setTableExists(true);
              return; // Éxito!
            }

            if (retryError && !retryError.message.includes('schema cache') && !retryError.message.includes('Could not find')) {
              // Si el error cambió completamente, puede ser otro problema
              console.warn('⚠️ Error diferente después del reintento:', retryError.message);
              // Continuar intentando si aún es schema cache
            }
          }

          // Si después de 5 intentos (hasta 45 segundos) sigue fallando, asumir que la tabla no existe
          console.warn('⚠️ La tabla news_likes no se encontró después de múltiples intentos');
          setTableExists(false);
          return; // Continuar sin likes
        }
        throw error;
      }

      if (data) {
        const likedIds = new Set(data.map(like => like.news_id));
        setLikedNewsIds(likedIds);
        setTableExists(true); // La tabla existe si pudimos leer datos
      }
    } catch (error) {
      console.log('Error cargando likes:', error);
      // Continuar sin likes si hay error
    }
  };

  // Cargar preferencias del usuario desde Supabase (userId anónimo) - SOLO funciona con Supabase
  const loadUserPreferences = async () => {
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase no configurado. Las preferencias no se cargarán.');
      // Limpiar preferencias locales si Supabase no está configurado
      setUserPreferences(new Map());
      return;
    }
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('category, source, score')
        .eq('user_id', USER_ID)
        .order('score', { ascending: false });

      if (error) throw error;

      if (data) {
        const prefs = new Map<string, number>();
        data.forEach(pref => {
          prefs.set(pref.category, pref.score);
          if (pref.source) {
            prefs.set(`source:${pref.source}`, pref.score);
          }
        });
        setUserPreferences(prefs);
      }
    } catch (error) {
      console.log('Error cargando preferencias:', error);
      // Continuar sin preferencias si hay error
    }
  };

  // Dar like a una noticia (guardado SOLO en Supabase con userId anónimo)
  const toggleLike = async (item: NewsItem) => {
    console.log('❤️ toggleLike llamado para:', item.id, item.title);

    if (!isSupabaseConfigured()) {
      console.error('❌ Supabase no configurado. Los likes requieren Supabase para funcionar.');
      setError('⚠️ Los likes requieren Supabase. Por favor, configura las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en Vercel.');
      setTimeout(() => setError(null), 5000);
      return;
    }

    const isLiked = likedNewsIds.has(item.id);
    console.log('📊 Estado actual - isLiked:', isLiked, 'USER_ID:', USER_ID);

    // ACTUALIZACIÓN OPTIMISTA (feedback inmediato como TikTok)
    // Actualizar el estado inmediatamente antes de la petición
    if (isLiked) {
      // Quitar like - actualización optimista
      setLikedNewsIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
      setRawNews(prevNews =>
        prevNews.map(n =>
          n.id === item.id
            ? { ...n, likes: Math.max(0, (n.likes || 0) - 1) }
            : n
        )
      );
    } else {
      // Agregar like - actualización optimista
      setLikedNewsIds(prev => new Set([...prev, item.id]));
      setRawNews(prevNews =>
        prevNews.map(n =>
          n.id === item.id
            ? { ...n, likes: (n.likes || 0) + 1 }
            : n
        )
      );
    }

    try {
      if (isLiked) {
        // Quitar like
        console.log('🗑️ Quitando like...');
        const { error } = await supabase
          .from('news_likes')
          .delete()
          .eq('user_id', USER_ID)
          .eq('news_id', item.id);

        if (error) {
          console.error('❌ Error al quitar like:', error);
          // Revertir actualización optimista en caso de error
          setLikedNewsIds(prev => new Set([...prev, item.id]));
          setRawNews(prevNews =>
            prevNews.map(n =>
              n.id === item.id
                ? { ...n, likes: (n.likes || 0) + 1 }
                : n
            )
          );
          // Don't throw - just log and continue
          console.warn('Like removal failed but app continues');
          return;
        }

        console.log('✅ Like quitado exitosamente');
      } else {
        // Agregar like
        console.log('➕ Agregando like...');
        const { error } = await supabase
          .from('news_likes')
          .insert({
            user_id: USER_ID,
            news_id: item.id,
            news_title: item.title,
            news_source: item.source,
            news_url: item.url || null
          });

        if (error) {
          console.error('❌ Error al agregar like:', error);

          // Revertir actualización optimista en caso de error
          setLikedNewsIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(item.id);
            return newSet;
          });
          setRawNews(prevNews =>
            prevNews.map(n =>
              n.id === item.id
                ? { ...n, likes: Math.max(0, (n.likes || 0) - 1) }
                : n
            )
          );

          // Show user-friendly error briefly
          toastShadcn({ title: "Error", description: "No se pudo guardar el like", duration: 2000 });
          return;
        }

        console.log('✅ Like agregado exitosamente');
        setTableExists(true);

        // Recargar preferencias después de dar like (non-blocking)
        setTimeout(() => {
          loadUserPreferences().catch(console.error);
        }, 1000);
      }
    } catch (error: any) {
      console.error('❌ Error inesperado al dar like:', error);
      // Catch-all to prevent app crash
      toastShadcn({ title: "Error", description: "Error al procesar like", duration: 2000 });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Fecha no disponible';

    try {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'Ahora';
      if (minutes < 60) return `Hace ${minutes} min`;
      if (hours < 24) return `Hace ${hours} h`;
      if (days < 7) return `Hace ${days} días`;

      return date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    } catch (e) {
      return dateString;
    }
  };

  const escapeHtml = (text: string) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    let cleaned = div.innerHTML
      .replace(/<a[^>]*>.*?<\/a>/gi, '')
      .replace(/<img[^>]*>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    return cleaned;
  };

  const getSourceColor = (source: string) => {
    const colors = [
      { gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', badge: 'rgba(102, 126, 234, 0.25)', border: 'rgba(102, 126, 234, 0.5)' },
      { gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', badge: 'rgba(245, 87, 108, 0.25)', border: 'rgba(245, 87, 108, 0.5)' },
      { gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', badge: 'rgba(79, 172, 254, 0.25)', border: 'rgba(79, 172, 254, 0.5)' },
      { gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', badge: 'rgba(67, 233, 123, 0.25)', border: 'rgba(67, 233, 123, 0.5)' },
      { gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', badge: 'rgba(250, 112, 154, 0.25)', border: 'rgba(250, 112, 154, 0.5)' },
      { gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', badge: 'rgba(48, 207, 208, 0.25)', border: 'rgba(48, 207, 208, 0.5)' },
      { gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', badge: 'rgba(168, 237, 234, 0.25)', border: 'rgba(168, 237, 234, 0.5)' },
      { gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', badge: 'rgba(255, 154, 158, 0.25)', border: 'rgba(255, 154, 158, 0.5)' },
      { gradient: 'linear-gradient(135deg, #fa8bff 0%, #2bd2ff 50%, #2bff88 100%)', badge: 'rgba(250, 139, 255, 0.25)', border: 'rgba(250, 139, 255, 0.5)' },
      { gradient: 'linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%)', badge: 'rgba(255, 234, 167, 0.25)', border: 'rgba(255, 234, 167, 0.5)' }
    ];
    const hash = source.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const getThemeIcon = (title: string) => {
    const titleLower = title.toLowerCase();
    const icons: { [key: string]: string } = {
      política: '🏛️', politico: '🏛️', gobierno: '🏛️', elecciones: '🗳️', partido: '🏛️',
      tecnología: '💻', tech: '💻', innovación: '🚀', digital: '💻', app: '📱',
      economía: '💰', económico: '💰', mercado: '📈', empresa: '🏢', negocio: '💼',
      salud: '🏥', médico: '⚕️', hospital: '🏥', medicina: '💊',
      deportes: '⚽', deporte: '⚽', fútbol: '⚽', baloncesto: '🏀',
      cultura: '🎭', arte: '🎨', música: '🎵', cine: '🎬',
      ciencia: '🔬', investigación: '🔬', estudio: '📊',
      internacional: '🌍', mundo: '🌍', país: '🗺️',
      sociedad: '👥', social: '👥', comunidad: '👥',
      medioambiente: '🌱', clima: '🌡️', sostenibilidad: '♻️'
    };

    for (const [keyword, icon] of Object.entries(icons)) {
      if (titleLower.includes(keyword)) {
        return icon;
      }
    }

    return '📰';
  };


  const openChat = (item: NewsItem) => {
    toast("Próximamente", {
      description: "La función de chat con IA estará disponible muy pronto.",
    });
  };

  // Función para feedback háptico sutil
  const triggerHapticFeedback = (intensity: 'light' | 'medium' | 'strong' = 'light') => {
    if ('vibrate' in navigator) {
      const patterns = {
        light: [5],      // Vibración muy sutil
        medium: [10],    // Vibración media
        strong: [15]     // Vibración más fuerte
      };
      navigator.vibrate(patterns[intensity]);
    }
  };

  const setupTikTokScroll = () => {
    if (!feedContainerRef.current) return;

    const container = feedContainerRef.current;
    let scrollTimeout: NodeJS.Timeout;
    let isScrolling = false;
    let lastScrollTop = 0;
    let scrollVelocity = 0;
    let lastScrollTime = Date.now();
    let rafId: number | null = null;
    let currentCardIndex = -1;
    let lastSnappedIndex = -1;

    const getCardHeight = () => {
      // Usar window.innerHeight para obtener altura real del viewport (incluye barras del navegador)
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const headerHeight = isMobile ? 60 : 70;
      // Asegurar que siempre haya espacio visible
      return Math.max(viewportHeight - headerHeight, 400);
    };

    const getCurrentCardIndex = () => {
      const scrollTop = container.scrollTop;
      const cardHeight = getCardHeight();
      return Math.round(scrollTop / cardHeight);
    };

    const snapToNearestCard = (immediate = false, skipHaptic = false) => {
      if (isScrolling && !immediate) return;

      const cards = container.querySelectorAll('.news-card');
      if (cards.length === 0) return;

      const scrollTop = container.scrollTop;
      const cardHeight = getCardHeight();
      const targetIndex = Math.round(scrollTop / cardHeight);
      const limitedIndex = Math.max(0, Math.min(targetIndex, cards.length - 1));
      const targetScroll = limitedIndex * cardHeight;
      const distance = Math.abs(scrollTop - targetScroll);

      // Snap más suave y controlado - umbrales más altos para evitar cambios bruscos
      const snapThreshold = isMobile
        ? (immediate ? 20 : 50)  // En móvil: más espacio antes de snap
        : (immediate ? 30 : 60); // En desktop: umbral más alto

      if (distance > snapThreshold || immediate) {
        // Feedback háptico solo si cambiamos de card (más suave)
        if (!skipHaptic && limitedIndex !== lastSnappedIndex && lastSnappedIndex !== -1) {
          triggerHapticFeedback(isMobile ? 'light' : 'light');
        }
        lastSnappedIndex = limitedIndex;

        isScrolling = true;

        // Efectos visuales más suaves y visibles
        const currentCard = cards[limitedIndex] as HTMLElement;
        if (currentCard) {
          if (isMobile) {
            // En móvil: efectos más visibles pero suaves
            currentCard.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.6s ease';
            currentCard.style.transform = 'scale(0.98)';
            currentCard.style.opacity = '0.95';
          } else {
            // En desktop: efectos más pronunciados y suaves
            currentCard.style.transition = 'transform 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.7s ease';
            currentCard.style.transform = 'scale(0.97)';
            currentCard.style.opacity = '0.92';
          }
        }

        // Usar requestAnimationFrame para scroll más suave con easing mejorado
        const startScroll = scrollTop;
        const startTime = performance.now();
        // Duración más larga para scroll más suave y visible
        const duration = isMobile
          ? (immediate ? 500 : 700)  // Móvil: más suave y visible
          : (immediate ? 600 : 800); // Desktop: más suave y visible

        const animateScroll = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Easing más suave y gradual (ease-out-cubic mejorado con curva más suave)
          const ease = 1 - Math.pow(1 - progress, 2.5); // Reducido de 3.5 a 2.5 para más suavidad
          const currentScroll = startScroll + (targetScroll - startScroll) * ease;

          container.scrollTop = currentScroll;

          if (progress < 1) {
            rafId = requestAnimationFrame(animateScroll);
          } else {
            container.scrollTop = targetScroll;
            isScrolling = false;
            rafId = null;

            // Restaurar efecto visual con transición suave
            if (currentCard) {
              setTimeout(() => {
                currentCard.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease';
                currentCard.style.transform = 'scale(1)';
                currentCard.style.opacity = '1';
              }, isMobile ? 100 : 150); // Más tiempo para transición suave
            }
          }
        };

        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(animateScroll);
      } else {
        isScrolling = false;
      }
    };

    // Manejar scroll con mejor detección de velocidad y snap más inmediato
    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      const currentTime = Date.now();
      const timeDelta = currentTime - lastScrollTime;

      if (timeDelta > 0) {
        scrollVelocity = Math.abs(currentScrollTop - lastScrollTop) / timeDelta;
      }

      // Detectar cambio de card para efectos visuales (más sutiles en móvil)
      const newCardIndex = getCurrentCardIndex();
      if (newCardIndex !== currentCardIndex && currentCardIndex !== -1) {
        // Aplicar efecto visual sutil al card actual
        const cards = container.querySelectorAll('.news-card');
        const prevCard = cards[currentCardIndex] as HTMLElement;
        const newCard = cards[newCardIndex] as HTMLElement;

        if (prevCard) {
          prevCard.style.transform = 'scale(1)';
          prevCard.style.opacity = '1';
        }
        if (newCard) {
          // Efectos más sutiles en móvil para mejor rendimiento
          if (isMobile) {
            newCard.style.transform = 'scale(1.005)';
            newCard.style.opacity = '1';
          } else {
            newCard.style.transform = 'scale(1.01)';
            newCard.style.opacity = '1';
          }
        }
      }
      currentCardIndex = newCardIndex;

      lastScrollTop = currentScrollTop;
      lastScrollTime = currentTime;

      // Cancelar snap anterior si el usuario sigue scrolleando
      if (scrollTimeout) clearTimeout(scrollTimeout);

      // Snap más suave y controlado - delays más largos para evitar cambios bruscos
      const snapDelay = isMobile
        ? (scrollVelocity > 1.5 ? 300 : 200)  // Móvil: más tiempo antes de snap
        : (scrollVelocity > 1.5 ? 400 : 250);   // Desktop: más tiempo antes de snap

      scrollTimeout = setTimeout(() => {
        // Umbral de velocidad más alto para snap más suave (esperar a que pare más)
        const velocityThreshold = isMobile ? 0.05 : 0.03; // Reducido para esperar más tiempo
        if (scrollVelocity < velocityThreshold) {
          snapToNearestCard(false, false);
        }
      }, snapDelay);
    };

    // Scroll con rueda mejorado para desktop - más responsivo y fluido
    let wheelTimeout: NodeJS.Timeout;
    let wheelAccumulator = 0;
    const handleWheel = (e: WheelEvent) => {
      const delta = e.deltaY;
      wheelAccumulator += delta;

      // Limpiar acumulador después de un tiempo más corto para mejor respuesta
      if (wheelTimeout) clearTimeout(wheelTimeout);
      wheelTimeout = setTimeout(() => {
        wheelAccumulator = 0;
      }, 100); // Reducido de 150 a 100

      // Umbral más bajo para scroll más responsivo
      if (Math.abs(wheelAccumulator) > 30 && !isScrolling) { // Reducido de 50 a 30
        const direction = wheelAccumulator > 0 ? 1 : -1;
        const cardHeight = getCardHeight();
        const currentScroll = container.scrollTop;
        const currentIndex = Math.round(currentScroll / cardHeight);
        const cards = container.querySelectorAll('.news-card');
        const nextIndex = Math.max(0, Math.min(currentIndex + direction, cards.length - 1));

        if (nextIndex !== currentIndex) {
          isScrolling = true;
          wheelAccumulator = 0;

          // Feedback háptico sutil en desktop (si está disponible)
          triggerHapticFeedback('light');

          // Scroll suave con requestAnimationFrame y easing mejorado
          const startScroll = currentScroll;
          const targetScroll = nextIndex * cardHeight;
          const startTime = performance.now();
          const duration = 700; // Más lento para scroll más suave y visible

          // Aplicar efecto visual más suave y visible
          const currentCard = cards[currentIndex] as HTMLElement;
          const nextCard = cards[nextIndex] as HTMLElement;
          if (currentCard) {
            currentCard.style.transition = 'transform 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.7s ease';
            currentCard.style.transform = 'scale(0.97)';
            currentCard.style.opacity = '0.9';
          }
          if (nextCard) {
            nextCard.style.transition = 'transform 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.7s ease';
            nextCard.style.transform = 'scale(1.02)';
            nextCard.style.opacity = '1';
          }

          const animateWheelScroll = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Easing más suave y gradual
            const ease = 1 - Math.pow(1 - progress, 2.5); // Reducido de 3.5 a 2.5
            const currentScrollPos = startScroll + (targetScroll - startScroll) * ease;

            container.scrollTop = currentScrollPos;

            if (progress < 1) {
              rafId = requestAnimationFrame(animateWheelScroll);
            } else {
              container.scrollTop = targetScroll;
              isScrolling = false;
              rafId = null;

              // Restaurar efectos visuales con transición suave
              if (currentCard) {
                setTimeout(() => {
                  currentCard.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease';
                  currentCard.style.transform = 'scale(1)';
                  currentCard.style.opacity = '1';
                }, 150);
              }
              if (nextCard) {
                setTimeout(() => {
                  nextCard.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease';
                  nextCard.style.transform = 'scale(1)';
                  nextCard.style.opacity = '1';
                }, 150);
              }

              snapToNearestCard(true, true);
            }
          };

          if (rafId) {
            cancelAnimationFrame(rafId);
          }
          rafId = requestAnimationFrame(animateWheelScroll);

          e.preventDefault();
        }
      }
    };

    // Manejar touch events mejorado para scroll más fluido y responsivo en móvil
    let touchStartY = 0;
    let touchStartTime = 0;
    let isTouching = false;
    let touchMoveY = 0;
    let touchMoveTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
      touchMoveY = touchStartY;
      touchMoveTime = touchStartTime;
      isTouching = true;
      scrollVelocity = 0;

      // Efecto visual sutil al iniciar touch
      const currentIndex = getCurrentCardIndex();
      const cards = container.querySelectorAll('.news-card');
      const currentCard = cards[currentIndex] as HTMLElement;
      if (currentCard) {
        currentCard.style.transition = 'transform 0.2s ease';
        currentCard.style.transform = 'scale(0.99)';
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouching) return;
      touchMoveY = e.touches[0].clientY;
      touchMoveTime = Date.now();

      // Efecto visual más sutil en móvil para mejor rendimiento
      const deltaY = touchMoveY - touchStartY;
      const currentIndex = getCurrentCardIndex();
      const cards = container.querySelectorAll('.news-card');
      const currentCard = cards[currentIndex] as HTMLElement;

      if (currentCard && Math.abs(deltaY) > 15) {
        // Efectos más sutiles en móvil
        const maxScale = 0.03; // Reducido de 0.05 para móvil
        const maxOpacity = 0.15; // Reducido de 0.2 para móvil
        const scale = 1 - Math.min(Math.abs(deltaY) / 600, maxScale);
        const opacity = 1 - Math.min(Math.abs(deltaY) / 400, maxOpacity);
        currentCard.style.transform = `scale(${scale})`;
        currentCard.style.opacity = `${opacity}`;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isTouching) return;

      const touchEndY = e.changedTouches[0].clientY;
      const touchEndTime = Date.now();
      const distance = Math.abs(touchStartY - touchEndY);
      const duration = touchEndTime - touchStartTime;
      const velocity = distance / duration; // Velocidad del swipe

      // Restaurar efecto visual
      const currentIndex = getCurrentCardIndex();
      const cards = container.querySelectorAll('.news-card');
      const currentCard = cards[currentIndex] as HTMLElement;
      if (currentCard) {
        currentCard.style.transform = 'scale(1)';
        currentCard.style.opacity = '1';
      }

      // Snap más inteligente y suave basado en velocidad y distancia
      if (duration < 200 && distance > 50) {
        // Swipe muy rápido - snap suave con feedback háptico medio
        triggerHapticFeedback('medium');
        setTimeout(() => {
          snapToNearestCard(true, false);
        }, 100); // Más tiempo para transición suave
      } else if (duration < 300 && distance > 60) {
        // Swipe rápido - snap suave con feedback háptico ligero
        triggerHapticFeedback('light');
        setTimeout(() => {
          snapToNearestCard(true, false);
        }, 150);
      } else if (velocity > 0.3 && distance > 40) {
        // Swipe con buena velocidad - snap suave con feedback ligero
        triggerHapticFeedback('light');
        setTimeout(() => {
          snapToNearestCard(true, false);
        }, 200); // Más tiempo para transición suave
      } else {
        // Snap normal después de que termine el momentum - más tiempo para suavidad
        setTimeout(() => {
          snapToNearestCard(false, false);
        }, 300); // Aumentado para scroll más suave
      }

      isTouching = false;
    };

    // Inicializar índice actual
    currentCardIndex = getCurrentCardIndex();
    lastSnappedIndex = currentCardIndex;

    // Agregar event listeners
    container.addEventListener('scroll', handleScroll, { passive: true });

    if (!isMobile) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    } else {
      container.addEventListener('touchstart', handleTouchStart, { passive: true });
      container.addEventListener('touchmove', handleTouchMove, { passive: true });
      container.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    // Cleanup function
    return () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      if (wheelTimeout) clearTimeout(wheelTimeout);
      if (rafId) cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', handleScroll);
      if (!isMobile) {
        container.removeEventListener('wheel', handleWheel);
      } else {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
      }
    };
  };

  // Verificar si hay error de configuración
  const supabaseConfigured = isSupabaseConfigured();

  // Final return with stable hook structure
  // Final return with stable hook structure
  return (
    <div className="h-[100dvh] w-full bg-[#020504] text-white font-sans selection:bg-emerald-500/30 selection:text-emerald-400 overflow-hidden flex flex-col relative">
      <div className="noise-overlay" />
      <div className="scanline" />
      <div className="tactical-grid fixed inset-0 pointer-events-none opacity-[0.02]" />

      <AnimatePresence mode="wait">
        <motion.div 
          key="main-app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex-1 flex flex-col overflow-hidden"
        >
            {/* Premium Tactical Header - Fiel a la captura */}
            <motion.header 
              initial={{ y: -100 }}
              animate={{ y: 0 }}
              className="w-full z-[100] bg-[#020504]/90 backdrop-blur-xl border-b border-emerald-500/10 flex flex-col"
            >
              {/* Main Nav Row */}
              <div className="px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 border-l-2 border-emerald-500 pl-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-emerald-500" />
                        <span className="text-[11px] font-black text-emerald-500 tracking-[0.2em] uppercase italic">Veridian_System_v2</span>
                      </div>
                      <span className="text-[8px] font-mono text-emerald-500/40 tracking-[0.4em] mt-0.5 uppercase">• Active Tactical Feed</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Readiness Streak - Naranja táctico */}
                  <div className="flex items-center gap-2 px-3 py-1 bg-orange-500/5 border border-orange-500/20 rounded-sm">
                    <Zap className="w-2.5 h-2.5 text-orange-500 fill-orange-500" />
                    <div className="flex flex-col">
                      <span className="text-[6px] font-black text-orange-500/60 uppercase leading-none tracking-tighter">Readiness_Streak</span>
                      <span className="text-[9px] font-black text-orange-500 uppercase leading-none mt-0.5">0_DAYS</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Marquee Row - Más visible */}
              <div className="w-full py-1.5 bg-emerald-500/5 border-y border-emerald-500/10 overflow-hidden">
                <motion.div 
                  animate={{ x: [0, -1000] }}
                  transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                  className="flex whitespace-nowrap"
                >
                  <span className="text-[9px] font-mono text-white/60 font-bold tracking-[0.3em] uppercase">{marqueeText} // SYSTEM_STABLE // NO_THREATS_DETECTED</span>
                  <span className="text-[9px] font-mono text-white/60 font-bold tracking-[0.3em] uppercase ml-20">{marqueeText} // SYSTEM_STABLE</span>
                </motion.div>
              </div>

              {/* Categories Bar - Pill Style */}
              <div className="px-4 py-2 overflow-x-auto no-scrollbar flex items-center gap-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-1 rounded-full text-[9px] font-black tracking-[0.15em] uppercase transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-white/5 text-white/30 hover:text-white'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </motion.header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden relative flex flex-col">
              {/* TikTok Style Scroller (Mobile Optimized) */}
              <div 
                ref={feedContainerRef}
                className="flex-1 overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
              >
                {displayNews.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
                    <Brain className="w-12 h-12 text-white/10 animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Esperando transmision de datos...</p>
                  </div>
                ) : (
                  displayNews.map((item, index) => (
                    <div 
                      key={item.id} 
                      data-index={index}
                      className="news-card h-[100dvh] w-full snap-start snap-always shrink-0 overflow-hidden relative"
                    >
                      <NewsCard
                        item={{ ...item, isLiked: likedNewsIds.has(item.id) }}
                        isActive={currentVisibleNews?.id === item.id}
                        index={index}
                        onLike={() => toggleLike(item)}
                        onShare={() => {
                          navigator.clipboard.writeText(`${item.title}\n${window.location.origin}/veridian-news?newsId=${item.id}`);
                          toast.success("Enlace Copiado", { description: "Protocolo de compartido activado." });
                        }}
                        onReadMore={() => openFullContent(item)}
                        category={item.category || detectCategory(item.title, item.content)}
                      />
                    </div>
                  ))
                )}
              </div>

            </main>

            {/* Bottom Status Bar - Moved outside main for fixed positioning */}
            <footer className="fixed bottom-[85px] left-0 right-0 px-6 py-4 border-t border-white/5 bg-black/60 backdrop-blur-md flex items-center justify-between text-[9px] font-mono text-white/20 uppercase tracking-[0.3em] z-[50]">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${isOffline ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 animate-pulse'} `} />
                  LINK_STATUS: {isOffline ? 'OFFLINE_RETRYING' : 'SECURE'}
                </span>
              </div>
              <div className="flex items-center gap-6">
                <span>{new Date().toLocaleTimeString()}</span>
                <span className="text-emerald-500/40">VERIDIAN_CORP</span>
              </div>
            </footer>

            {/* Premium Reader Modal */}
            <AnimatePresence>
              {showContentModal && selectedNews && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-3xl overflow-y-auto px-6 py-20 flex justify-center"
                >
                  <div className="noise-overlay" />
                  <motion.div 
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 50, opacity: 0 }}
                    className="w-full max-w-4xl space-y-12 relative"
                  >
                    <button 
                      onClick={() => setShowContentModal(false)}
                      className="fixed top-8 right-8 w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all z-50 shadow-2xl"
                    >
                      <X className="w-6 h-6" />
                    </button>

                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                          {selectedNews.source}
                        </span>
                        <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                        <span className="text-white/30 text-[10px] font-mono tracking-widest">{new Date(selectedNews.date).toLocaleString()}</span>
                      </div>
                      <h1 className="text-4xl md:text-6xl font-black uppercase italic leading-[0.95] tracking-tighter text-white">
                        {selectedNews.title}
                      </h1>
                      <div className="h-1.5 w-40 bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
                    </div>

                    {selectedNews.image && (
                      <div className="w-full aspect-video rounded-[40px] overflow-hidden border border-white/10 shadow-2xl">
                        <img src={selectedNews.image} className="w-full h-full object-cover" alt="" />
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                      <div className="md:col-span-2 space-y-12">
                        {/* Tactical Analysis Block - NEW */}
                        {selectedNews.analysis && (
                          <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="p-8 bg-emerald-500/5 border border-emerald-500/20 rounded-[32px] relative overflow-hidden group"
                          >
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                              <Brain className="w-12 h-12 text-emerald-500" />
                            </div>
                            <div className="flex items-center gap-2 mb-6">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">Informe de Inteligencia // Supabase_Link</span>
                            </div>
                            <div className="text-xl md:text-2xl text-emerald-100/90 font-mono italic leading-relaxed">
                              "{selectedNews.analysis}"
                            </div>
                          </motion.div>
                        )}

                        <div className="text-lg md:text-xl text-zinc-300 font-sans font-light leading-relaxed space-y-6">
                          {selectedNews.content && selectedNews.content !== 'Contenido restringido.' && 
                            selectedNews.content
                              .replace(/^\*\*.*?\*\*/, '') // Eliminar títulos en negrita al principio
                              .split('\n')
                              .map((p, i) => {
                                const trimmed = p.trim();
                                if (!trimmed) return null;
                                
                                // Detectar "Fuentes consultadas"
                                if (trimmed.includes('### Fuentes') || trimmed.toLowerCase() === 'fuentes consultadas' || trimmed === 'Fuentes:') {
                                  return <h4 key={i} className="text-sm font-mono text-emerald-500/80 mt-12 mb-4 uppercase tracking-wider border-b border-white/5 pb-2">Fuentes Consultadas</h4>;
                                }

                                // Detectar URLs crudas y convertirlas en botones de fuente
                                if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                                  let sourceName = 'Enlace original';
                                  try {
                                    const domain = new URL(trimmed).hostname;
                                    sourceName = domain.replace('www.', '').split('.')[0];
                                    sourceName = sourceName.charAt(0).toUpperCase() + sourceName.slice(1);
                                  } catch (e) {}
                                  
                                  return (
                                    <div key={i} className="mt-2">
                                      <a href={trimmed} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 rounded-md transition-all text-sm font-mono border border-emerald-500/20">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        Fuente: {sourceName}
                                      </a>
                                    </div>
                                  );
                                }

                                return <p key={i}>{trimmed}</p>;
                              })
                          }
                        </div>
                        {selectedNews.url && (
                          <a 
                            href={selectedNews.url} 
                            target="_blank" 
                            className="inline-flex items-center gap-3 px-8 py-4 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-xl hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Visitar Fuente Original
                          </a>
                        )}
                      </div>
                      <div className="space-y-8">
                        <div className="p-8 bg-white/5 border border-white/10 rounded-[32px] space-y-8 sticky top-24">
                              <div className="flex items-center justify-between text-emerald-400">
                                <div className="flex items-center gap-3">
                                  <Brain className={`w-5 h-5 ${isAiLoading ? 'animate-pulse' : ''}`} />
                                  <span className="text-[12px] font-black uppercase tracking-[0.2em]">Analysis_Veridian</span>
                                </div>
                                {isAiLoading && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />}
                              </div>

                          <div className="space-y-6">
                            {isAiLoading ? (
                              <div className="space-y-4 animate-pulse">
                                <div className="h-4 bg-white/5 rounded w-3/4" />
                                <div className="h-4 bg-white/5 rounded w-full" />
                                <div className="h-4 bg-white/5 rounded w-5/6" />
                              </div>
                            ) : aiAnalysis ? (
                              <>
                                <div className="space-y-3">
                                  <div className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest">¿Qué significa?</div>
                                  <p className="text-[13px] text-zinc-300 leading-relaxed italic border-l border-emerald-500/30 pl-4">
                                    {aiAnalysis.meaning}
                                  </p>
                                </div>
                                <div className="space-y-4">
                                  <div className="text-[9px] font-black text-orange-500/60 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1 h-1 bg-orange-500 rounded-full animate-pulse" />
                                    ¿Cómo afecta?
                                  </div>
                                  <div className="space-y-4 border-l border-orange-500/20 pl-4">
                                    {typeof aiAnalysis.impact === 'string' && aiAnalysis.impact.split(/[-•]/).map(p => p.trim()).filter(Boolean).map((point, idx) => (
                                      <div key={idx} className="flex gap-3 items-start group">
                                        <div className="mt-1.5 w-1.5 h-1.5 rotate-45 bg-orange-500/30 group-hover:bg-orange-500 transition-all duration-300 shrink-0 shadow-[0_0_10px_rgba(249,115,22,0.2)]" />
                                        <span className="text-[13px] text-zinc-300 leading-tight font-light group-hover:text-white transition-colors">
                                          {point}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="space-y-4">
                                {extractKeyPoints(selectedNews.content || selectedNews.summary).map((point, i) => (
                                  <div key={i} className="flex gap-4">
                                    <span className="text-emerald-500/50 font-mono text-xs">0{i+1}</span>
                                    <p className="text-[13px] text-zinc-400 leading-relaxed italic">{point}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          <div className="pt-4 border-t border-white/5">
                            <div className="text-[8px] font-mono text-white/20 uppercase tracking-widest">
                              Powered_by_Gemini_1.5_Flash
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <BottomDock />
            
            {/* Onboarding Overlay - Non-blocking tactical welcome */}
            <AnimatePresence>
              {showOnboarding && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm px-4 flex items-center justify-center pointer-events-none"
                >
                  <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="bg-[#050B0A]/90 border border-emerald-500/30 rounded-xl p-8 w-full max-w-sm flex flex-col items-center text-center shadow-[0_0_100px_rgba(16,185,129,0.2)] pointer-events-auto"
                    onMouseEnter={() => {
                      // Optional: stay open if hovered
                    }}
                  >
                    <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
                      <Shield className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic mb-2">SISTEMA_ACTIVO</h3>
                    <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
                      Nodo central Veridian sincronizado. Desliza para navegar por el feed táctico.
                    </p>
                    <button
                      onClick={handleCompleteOnboarding}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-all shadow-lg shadow-emerald-500/20"
                    >
                      Entendido_Operador
                    </button>
                    
                    {/* Auto-close indicator */}
                    <div className="w-full h-1 bg-white/5 mt-4 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{ duration: 4, ease: "linear" }}
                        className="h-full bg-emerald-500/30"
                      />
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default VeridianNews;
// VERIDIAN_SYSTEM_SYNC_ACTIVE_2024_05_04_1340
