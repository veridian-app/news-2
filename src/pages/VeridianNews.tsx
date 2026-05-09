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
import { NewsCard } from "../components/NewsCard";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSearch } from "@/contexts/SearchContext";
import { NewsItem } from "@/types/news";
import { IntelligencePanel } from "../components/IntelligencePanel";
import { OnboardingOverlay } from "../components/OnboardingOverlay";
import { normalizeCategory, detectCategory, shuffleNews, recommendNews, extractKeyPoints, searchNews } from "@/utils/news-utils";
import { mixpanelTrack } from "@/lib/mixpanel";
import { startTransition } from "react";



export default function VeridianNews() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const screenSize = useScreenSize();
  const { toast: toastShadcn } = useToast();
  const { user, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Mover constantes calculadas al interior del componente o useMemo
  const API_BASE = useMemo(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host !== 'localhost' && host !== '127.0.0.1') {
        return ''; 
      }
    }
    return import.meta.env.VITE_VERIDIAN_API_BASE || '';
  }, []);

  const USER_ID = useMemo(() => {
    if (user?.id) return user.id;
    
    // Fallback para contexto no autenticado
    let userId = localStorage.getItem('veridian_userId');
    if (!userId) {
      userId = `anon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('veridian_userId', userId);
    }
    return userId;
  }, [user]);

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
  const categoryBarRef = useRef<HTMLDivElement>(null);
  const loadingProgressRef = useRef<HTMLDivElement>(null);
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPrefetchingRef = useRef<boolean>(false);

  const [sortBy, setSortBy] = useState<'recommended' | 'recent'>('recommended');
  const [activeCategory, setActiveCategory] = useState<string>('TODO');

  // Búsqueda desde contexto compartido
  const { searchQuery, setSearchQuery, showSearchModal, closeSearch, setAllNews } = useSearch();

  // Sincronizar noticias con el buscador para búsqueda en vivo
  useEffect(() => {
    setAllNews(rawNews);
  }, [rawNews, setAllNews]);

  // Debounced search query para evitar colapso de UI
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        setDebouncedSearchQuery(searchQuery);
        // Auto-resetear categoría a TODO si el usuario empieza a buscar
        if (searchQuery.trim().length > 0) {
          setActiveCategory('TODO');
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Onboarding & Feedback
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');

  // Calcular noticias recomendadas basándose en preferencias y búsqueda
  const news = useMemo(() => {
    if (rawNews.length === 0) {
      return [];
    }

    // Primero filtrar por búsqueda si hay query (usando Fuse.js para máxima precisión)
    let searchResults = rawNews;
    const isSearching = debouncedSearchQuery.trim().length > 0;

    if (isSearching) {
      searchResults = searchNews(rawNews, debouncedSearchQuery);
      console.log(`🔍 Búsqueda táctica "${debouncedSearchQuery}": ${searchResults.length} resultados`);
      // Si estamos buscando, devolvemos los resultados de Fuse directamente (que ya vienen ordenados por relevancia)
      return searchResults;
    }

    // Si el usuario elige "Recientes", forzar orden cronológico
    if (sortBy === 'recent') {
      return [...rawNews].sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    }

    if (userPreferences.size === 0) {
      return shuffleNews([...rawNews]);
    }
    return recommendNews([...rawNews], userPreferences, likedNewsIds);
  }, [rawNews, userPreferences, likedNewsIds, sortBy, debouncedSearchQuery]);

  const categories = ['TODO', 'GEOPOLÍTICA', 'ESPAÑA', 'POLÍTICA', 'INTERNACIONAL', 'TECH', 'DEPORTES'];

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
  }, []);

  const handleCompleteOnboarding = () => {
    localStorage.setItem('veridian_onboarding_seen', 'true');
    setShowOnboarding(false);
  };

  useEffect(() => {
    const newsId = searchParams.get('newsId');
    if (newsId && news.length > 0 && feedContainerRef.current) {
      const index = news.findIndex(n => n.id === newsId);
      if (index !== -1) {
        const scrollPosition = index * window.innerHeight;
        feedContainerRef.current.scrollTo({
          top: scrollPosition,
          behavior: 'instant' 
        });
        setCurrentVisibleNews(news[index]);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('newsId');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [news, searchParams, setSearchParams]);

  useEffect(() => {
    const loadData = async () => {
      await loadNews();
      if (isSupabaseConfigured()) {
        try {
          loadUserLikes();
          loadUserPreferences();
        } catch (error) {
          console.error('Error cargando preferencias:', error);
        }
      }
    };
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (displayNews.length === 0) return;
    
    // Set initial active news if none is set
    if (!currentVisibleNews) {
      setCurrentVisibleNews(displayNews[0]);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            if (!isNaN(index) && displayNews[index]) {
              setCurrentVisibleNews(displayNews[index]);
            }
          }
        });
      },
      {
        root: feedContainerRef.current,
        threshold: 0.6,
      }
    );

    const cards = document.querySelectorAll('.news-card');
    cards.forEach((card) => observer.observe(card));

    return () => {
      cards.forEach((card) => observer.unobserve(card));
      observer.disconnect();
    };
  }, [displayNews]);

  // Background Prefetching of AI Analysis
  useEffect(() => {
    if (!currentVisibleNews || displayNews.length === 0) return;
    
    const prefetchActiveAndNext = async () => {
      if (isPrefetchingRef.current) return;
      
      const currentIndex = displayNews.findIndex(n => n.id === currentVisibleNews.id);
      if (currentIndex === -1) return;

      // Prefetch ONLY the next news item to avoid rate limits
      const item = displayNews[currentIndex + 1];
      if (!item || analysisCache[item.id]) return;

      isPrefetchingRef.current = true;
      try {
        const { analyzeNews } = await import("@/services/gemini");
        const cleanSummary = (item.summary || '').replace(/\.\.\.$/, '').trim();
        const cleanAnalysis = (item.analysis || '').replace(/\.\.\.$/, '').trim();
        const textToAnalyze = (item.content && item.content !== 'Contenido restringido.') 
          ? item.content 
          : `CONTEXTO_TÁCTICO: ${cleanAnalysis} | RESUMEN_ADICIONAL: ${cleanSummary}`;
          
        const analysis = await analyzeNews(item.title, textToAnalyze);
        setAnalysisCache(prev => ({ ...prev, [item.id]: analysis }));
      } catch (err) {
        console.warn("Prefetch warning:", err);
      } finally {
        isPrefetchingRef.current = false;
      }
    };
    
    if (prefetchTimeoutRef.current) clearTimeout(prefetchTimeoutRef.current);
    // Esperar 1 segundo antes de empezar a analizar (por si el usuario hace scroll rápido)
    prefetchTimeoutRef.current = setTimeout(prefetchActiveAndNext, 1000);

    return () => {
      if (prefetchTimeoutRef.current) clearTimeout(prefetchTimeoutRef.current);
    };
  }, [currentVisibleNews, displayNews]);

  const openFullContent = async (item: NewsItem) => {
    mixpanelTrack('article_read', {
      title: item.title,
      category: item.category || detectCategory(item.title, item.content),
      source: item.source || 'VERIDIAN_INTEL'
    });
    setSelectedNews(item);
    setShowContentModal(true);
    
    if (analysisCache[item.id]) {
      setAiAnalysis(analysisCache[item.id]);
      setIsAiLoading(false);
      return;
    }

    setAiAnalysis(null);
    setIsAiLoading(true);

    try {
      const cleanSummary = (item.summary || '').replace(/\.\.\.$/, '').trim();
      const cleanAnalysis = (item.analysis || '').replace(/\.\.\.$/, '').trim();
      const textToAnalyze = (item.content && item.content !== 'Contenido restringido.') 
        ? item.content 
        : `CONTEXTO_TÁCTICO: ${cleanAnalysis} | RESUMEN_ADICIONAL: ${cleanSummary}`;
        
      const { analyzeNews } = await import("@/services/gemini");
      const analysis = await analyzeNews(item.title, textToAnalyze);
      setAiAnalysis(analysis);
      setAnalysisCache(prev => ({ ...prev, [item.id]: analysis }));
    } catch (err) {
      console.error("Error analizando noticia con IA:", err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const loadNews = async () => {
    const cachedNews = localStorage.getItem('veridian_news_cache');
    if (cachedNews) {
      try {
        const parsedCache = JSON.parse(cachedNews);
        if (Array.isArray(parsedCache) && parsedCache.length > 0) {
          setRawNews(parsedCache);
        }
      } catch (e) { console.error(e); }
    } else {
      setIsLoading(true);
    }

    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await (supabase as any)
          .from('daily_news')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000);

        if (error) {
          console.error("❌ Error fetching from Supabase:", error);
        }

        if (data && data.length > 0) {
          console.log(`✅ Loaded ${data.length} news items from Supabase.`);
          const processed = data.map((item: any) => ({
            id: item.id,
            title: item.title,
            summary: item.summary,
            content: item.content || item.context || item.body || item.full_text || item.article || item.summary,
            image: item.image || item.image_url,
            date: item.published_at || item.created_at,
            source: item.source || 'VERIDIAN_INTEL',
            url: item.url,
            category: item.category || detectCategory(item.title, item.content || item.summary),
            analysis: item.analysis
          }));
          setRawNews(processed);
          localStorage.setItem('veridian_news_cache', JSON.stringify(processed));
          return;
        } else {
          console.warn("⚠️ Supabase returned empty data or null.");
        }
      } else {
        console.warn("⚠️ Supabase is not configured.");
      }
    } catch (error) { 
      console.error("❌ Unexpected error in loadNews:", error); 
    }
    setRawNews([]);
  };

  const loadUserLikes = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data } = await supabase
        .from('news_likes')
        .select('news_id')
        .eq('user_id', USER_ID);

      if (data) {
        setLikedNewsIds(new Set(data.map(like => like.news_id)));
        setTableExists(true);
      }
    } catch (error) { console.log(error); }
  };

  const loadUserPreferences = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data } = await supabase
        .from('user_preferences')
        .select('category, score')
        .eq('user_id', USER_ID);

      if (data) {
        const prefs = new Map<string, number>();
        data.forEach(pref => prefs.set(pref.category, pref.score));
        setUserPreferences(prefs);
      }
    } catch (error) { console.log(error); }
  };

  const toggleLike = async (item: NewsItem) => {
    if (!isSupabaseConfigured()) return;
    const isLiked = likedNewsIds.has(item.id);
    
    if (isLiked) {
      setLikedNewsIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
      await supabase.from('news_likes').delete().eq('user_id', USER_ID).eq('news_id', item.id);
    } else {
      setLikedNewsIds(prev => new Set([...prev, item.id]));
      await supabase.from('news_likes').insert({ user_id: USER_ID, news_id: item.id, news_title: item.title });
    }
  };

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
            <motion.header 
              initial={{ y: -100 }}
              animate={{ y: 0 }}
              className="w-full z-[100] bg-[#020504]/90 backdrop-blur-xl border-b border-emerald-500/10 flex flex-col"
            >
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
                  {searchQuery && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full"
                    >
                      <Search className="w-2.5 h-2.5 text-emerald-500" />
                      <span className="text-[9px] font-mono text-emerald-500 uppercase tracking-tighter max-w-[100px] truncate">
                        {searchQuery}
                      </span>
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="ml-1 p-0.5 hover:bg-emerald-500/20 rounded-full text-emerald-500/50 hover:text-emerald-500"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </motion.div>
                  )}
                  
                  <div className="flex items-center gap-2 px-3 py-1 bg-orange-500/5 border border-orange-500/20 rounded-sm">
                    <Zap className="w-2.5 h-2.5 text-orange-500 fill-orange-500" />
                    <div className="flex flex-col">
                      <span className="text-[6px] font-black text-orange-500/60 uppercase leading-none tracking-tighter">Readiness_Streak</span>
                      <span className="text-[9px] font-black text-orange-500 uppercase leading-none mt-0.5">0_DAYS</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full py-1.5 bg-emerald-500/5 border-y border-emerald-500/10 overflow-hidden relative">
                <div className="flex animate-marquee whitespace-nowrap">
                  <span className="text-[9px] font-mono text-white/60 font-bold tracking-[0.3em] uppercase pr-20">{marqueeText} // SYSTEM_STABLE // NO_THREATS_DETECTED</span>
                  <span className="text-[9px] font-mono text-white/60 font-bold tracking-[0.3em] uppercase pr-20">{marqueeText} // SYSTEM_STABLE // NO_THREATS_DETECTED</span>
                  <span className="text-[9px] font-mono text-white/60 font-bold tracking-[0.3em] uppercase pr-20">{marqueeText} // SYSTEM_STABLE // NO_THREATS_DETECTED</span>
                  <span className="text-[9px] font-mono text-white/60 font-bold tracking-[0.3em] uppercase pr-20">{marqueeText} // SYSTEM_STABLE // NO_THREATS_DETECTED</span>
                </div>
              </div>

              <div 
                ref={categoryBarRef}
                className="px-4 py-2 overflow-x-auto no-scrollbar flex items-center gap-2 cursor-grab active:cursor-grabbing"
                onWheel={(e) => {
                  if (categoryBarRef.current) {
                    categoryBarRef.current.scrollLeft += e.deltaY;
                  }
                }}
              >
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      if (activeCategory === cat) {
                        // Si ya está activa, volver al inicio
                        feedContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                        return;
                      }
                      startTransition(() => {
                        setActiveCategory(cat);
                        // Resetear scroll al inicio de la nueva categoría
                        if (feedContainerRef.current) {
                          feedContainerRef.current.scrollTop = 0;
                        }
                      });
                    }}
                    className={`px-4 py-1 rounded-full text-[9px] font-black tracking-[0.15em] uppercase transition-all whitespace-nowrap active:scale-95 ${activeCategory === cat ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-white/5 text-white/30 hover:text-white'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </motion.header>

            <main className="flex-1 overflow-hidden relative flex flex-col">
              <div 
                ref={feedContainerRef}
                className="flex-1 overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
              >
                {displayNews.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
                    {debouncedSearchQuery ? (
                      <>
                        <Search className="w-12 h-12 text-white/10" />
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 text-center">
                          Cero coincidencias tácticas para: <span className="text-emerald-500/40">"{debouncedSearchQuery}"</span>
                        </p>
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="mt-4 px-6 py-2 border border-emerald-500/20 rounded-full text-[9px] font-black uppercase tracking-widest text-emerald-500/60 hover:bg-emerald-500/10 transition-all"
                        >
                          Limpiar_Búsqueda
                        </button>
                      </>
                    ) : (
                      <>
                        <Brain className="w-12 h-12 text-white/10 animate-pulse" />
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Esperando transmision de datos...</p>
                      </>
                    )}
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
                          toastShadcn({ title: "Enlace Copiado", description: "Protocolo de compartido activado." });
                        }}
                        onReadMore={() => openFullContent(item)}
                        category={item.category || detectCategory(item.title, item.content)}
                      />
                    </div>
                  ))
                )}
              </div>
            </main>

            <IntelligencePanel 
              isOpen={showContentModal}
              onClose={() => setShowContentModal(false)}
              selectedNews={selectedNews}
              aiAnalysis={aiAnalysis}
              isAiLoading={isAiLoading}
              extractKeyPoints={extractKeyPoints}
            />

            <BottomDock />
            
            <OnboardingOverlay 
              show={showOnboarding}
              onComplete={handleCompleteOnboarding}
            />
          </motion.div>
      </AnimatePresence>
    </div>
  );
}


// VERIDIAN_SYSTEM_SYNC_ACTIVE_2024_05_04_1340
