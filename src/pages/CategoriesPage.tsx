import { useState, useEffect, useMemo } from "react";
import { CategoryAlbum } from "@/components/categories/CategoryAlbum";
import { CategoryView } from "@/components/categories/CategoryView";
import { BottomDock } from "@/components/BottomDock";
import { Loader2 } from "lucide-react";

interface NewsItem {
    id: string;
    title: string;
    summary: string;
    content: string;
    image?: string;
    date: string;
    source: string;
    url?: string;
    category?: string;
}

const API_BASE =
    import.meta.env.VITE_VERIDIAN_API_BASE || window.location.origin;

// Detectar categoría (copia sincronizada de VeridianNews)
const detectCategory = (title: string, content?: string): string => {
    const normalize = (text: string) => 
        text.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

    const textToAnalyze = normalize(`${title} ${content || ""}`);
    
    const matches = (keywords: string) => {
        const normalizedKeywords = normalize(keywords);
        const regex = new RegExp(`\\b(${normalizedKeywords})\\b`, "i");
        return regex.test(textToAnalyze);
    };

    if (matches('ucrania|rusia|otan|gaza|israel|iran|geopolitica|guerra|conflicto|misil|onu|unicef|interpol|embajada|diplomacia')) return 'GEOPOLÍTICA';
    if (matches('politica|gobierno|ley|elecciones|partido|sanchez|moncloa|congreso|senado|votos')) return 'POLÍTICA';
    if (matches('economia|ibex|nasdaq|bolsa|mercado|pib|inflacion|banco|euribor|financiero')) return 'ECONOMÍA';
    if (matches('sociedad|manifestacion|huelga|social|derechos|feminismo|poblacion|demografia')) return 'SOCIEDAD';
    if (matches('deporte|futbol|champions|liga|baloncesto|nba|tenis|olimpico')) return 'DEPORTES';
    if (matches('tecnologia|ia|ia generativa|software|hardware|silicon valley|apple|google|microsoft|startup|ciberseguridad')) return 'TECNOLOGÍA';
    if (matches('ciencia|nasa|espacio|descubrimiento|cientifico|laboratorio|investigacion|estudio|planeta')) return 'CIENCIA';
    if (matches('cultura|arte|cine|musica|teatro|literatura|libro|exposicion|concierto|festival')) return 'CULTURA';
    if (matches('salud|medicina|paciente|hospital|enfermedad|vacuna|bienestar|nutricion|virus|oms')) return 'SALUD';

    return "GEOPOLÍTICA"; // Default táctico
};

const CategoriesPage = () => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [allNews, setAllNews] = useState<NewsItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadNews = async () => {
            // Try cache first
            const cached = localStorage.getItem("veridian_news_cache");
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setAllNews(parsed);
                        setIsLoading(false);
                    }
                } catch (e) {
                    console.error("Error parsing cache:", e);
                }
            }

            // Fetch from API
            try {
                const response = await fetch(`${API_BASE}/api/news?limit=100`, {
                    signal: AbortSignal.timeout(5000),
                });
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data) && data.length > 0) {
                        setAllNews(data);
                        localStorage.setItem("veridian_news_cache", JSON.stringify(data));
                    }
                }
            } catch (e) {
                console.error("Error fetching news:", e);
            } finally {
                setIsLoading(false);
            }
        };

        loadNews();
    }, []);

    // Group news by category
    const categorizedNews = useMemo(() => {
        const map = new Map<string, NewsItem[]>();

        allNews.forEach((item) => {
            const category = item.category || detectCategory(item.title, item.content);
            const existing = map.get(category) || [];
            existing.push({ ...item, category });
            map.set(category, existing);
        });

        return map;
    }, [allNews]);

    // Build categories list sorted by count
    const categories = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayMs = today.getTime();

        const allItems = Array.from(categorizedNews.values()).flat();
        const uniqueAllItems = Array.from(new Map(allItems.map(item => [item.id, item])).values());

        const baseCategories = Array.from(categorizedNews.entries())
            .map(([name, items]) => ({
                name,
                count: items.length,
                hasToday: items.some((item) => {
                    try {
                        return new Date(item.date).getTime() >= todayMs;
                    } catch {
                        return false;
                    }
                }),
                icon: "",
                gradient: "",
                borderColor: "",
            }));

        // Add "TODO" as a virtual category
        const todoCategory = {
            name: 'TODO',
            count: uniqueAllItems.length,
            hasToday: uniqueAllItems.some(item => {
                try {
                    return new Date(item.date).getTime() >= todayMs;
                } catch {
                    return false;
                }
            }),
            icon: "",
            gradient: "",
            borderColor: "",
        };

        return [todoCategory, ...baseCategories]
            .sort((a, b) => {
                if (a.name === 'TODO') return -1;
                if (b.name === 'TODO') return 1;
                if (a.name === 'GEOPOLÍTICA') return -1;
                if (b.name === 'GEOPOLÍTICA') return 1;
                return b.count - a.count;
            });
    }, [categorizedNews]);

    if (isLoading && allNews.length === 0) {
        return (
            <div className="h-[100dvh] w-full flex items-center justify-center bg-zinc-950 text-white">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    <p className="text-white/50 animate-pulse">Cargando categorías...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] bg-zinc-950 text-white">
            {selectedCategory ? (
                <CategoryView
                    category={selectedCategory}
                    newsItems={categorizedNews.get(selectedCategory) || []}
                    onBack={() => setSelectedCategory(null)}
                />
            ) : (
                <div className="max-w-2xl mx-auto pt-6">
                    <CategoryAlbum
                        categories={categories}
                        onSelectCategory={setSelectedCategory}
                    />
                </div>
            )}

            <BottomDock />
        </div>
    );
};

export default CategoriesPage;
