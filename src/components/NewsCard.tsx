import { useState, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NewsImage } from "./NewsImage";
import { cn } from "@/lib/utils";
import { Share2, X, Shield, Clock, BookOpen, Globe, User, Link as LinkIcon, Cpu } from "lucide-react";
import { DoubleTapOverlay } from "./DoubleTapOverlay";
import { useHaptic } from "@/hooks/use-haptic";
import { toast } from "@/hooks/use-toast";
import { useDockVisibility } from "@/contexts/DockVisibilityContext";
import { useSavedNews } from "@/hooks/use-saved-news";

export interface NewsItem {
    id: string;
    title: string;
    summary: string;
    content: string;
    image?: string;
    date: string;
    source: string;
    url?: string;
    likes?: number;
    comments?: number;
    isLiked?: boolean;
    isSaved?: boolean;
    isRead?: boolean;
    category?: string;
}

interface NewsCardProps {
    item: NewsItem;
    isActive: boolean;
    index: number;
    onLike: () => void;
    onShare: () => void;
    onReadMore: () => void;
    category?: string;
}

export const NewsCard = memo(({ item, isActive, index, onLike, onShare, onReadMore, category }: NewsCardProps) => {
    // Logic for double tap
    const lastTap = useRef<number>(0);
    const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
    const [tapPosition, setTapPosition] = useState({ x: 0, y: 0 });
    const { trigger: haptic } = useHaptic();

    const singleTapTimeout = useRef<NodeJS.Timeout | null>(null);

    const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
        // Ignorar taps en los botones inferiores para no solapar acciones
        if ((e.target as HTMLElement).closest('button')) {
            return;
        }

        const now = Date.now();
        const DOUBLE_TAP_DELAY = 200;

        if (now - lastTap.current < DOUBLE_TAP_DELAY) {
            // Double tap detected
            if (singleTapTimeout.current) clearTimeout(singleTapTimeout.current);

            const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

            setTapPosition({ x: clientX, y: clientY });
            setShowDoubleTapHeart(true);
            haptic('medium');

            // Trigger like functionality
            if (!item.isLiked) {
                onLike();
            }

            setTimeout(() => setShowDoubleTapHeart(false), 800);
        } else {
            // Single tap: start timer for full content view
            singleTapTimeout.current = setTimeout(() => {
                onReadMore();
                haptic('light');
            }, DOUBLE_TAP_DELAY);
        }

        lastTap.current = now;
    };

    const handleShareClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        haptic('light');
        onShare();
    };

    const handleReadMoreClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        haptic('medium');
        onReadMore();
    };

    const dateStr = new Date(item.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }).toUpperCase();
    
    let cleanSource = (item.source || 'VERIDIAN').toUpperCase();
    if (cleanSource.startsWith('HTTP')) {
        try {
            cleanSource = new URL(item.source.toLowerCase()).hostname.replace('www.', '').toUpperCase();
        } catch (e) {}
    }
    
    const displayCategory = (category || item.category || 'GENERAL').toUpperCase();

    return (
        <div
            className="relative h-full w-full bg-[#020504] select-none font-mono flex items-center justify-center overflow-hidden"
            onClick={handleTap}
            style={{ 
              willChange: 'transform, opacity',
              transform: 'translateZ(0)'
            }}
        >
            <DoubleTapOverlay showLike={showDoubleTapHeart} position={tapPosition} />

            {/* Optimized Background Effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Mesh Gradient - Simplified */}
                <div className="absolute inset-0 opacity-[0.12]" style={{
                    background: 'radial-gradient(circle at 50% 50%, #10B981 0%, transparent 70%)',
                    filter: 'blur(60px)'
                }} />
                
                {/* Fine Grid - Very light for performance */}
                <div className="absolute inset-0 opacity-[0.02]" style={{
                    backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                    backgroundSize: '30px 30px'
                }} />
            </div>

            {/* Content Container - Immersive full-screen */}
            <div className="relative w-full h-full flex flex-col justify-between gap-2 px-6 md:px-12 pt-40 pb-28 md:pt-48 md:pb-32 z-10 max-w-4xl mx-auto overflow-hidden">
                
                <div className="flex flex-col gap-3 md:gap-6 flex-1 min-h-0">
                    {/* Meta Top Bar */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={isActive ? { opacity: 1 } : {}}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-2 py-0.5 border border-emerald-500/40 rounded-sm bg-emerald-500/5">
                                <Shield className="w-2.5 h-2.5 text-emerald-500" />
                                <span className="text-[8px] md:text-[10px] text-emerald-400 font-bold tracking-[0.2em]">{displayCategory}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-0.5 border border-emerald-500/20 bg-black/40 rounded-sm text-emerald-500/70 text-[8px] md:text-[10px] font-bold tracking-widest">
                            <Clock className="w-2.5 h-2.5" />
                            {dateStr}
                        </div>
                    </motion.div>
 
                    {/* Main Headline */}
                    <div className="flex flex-col gap-2 md:gap-6">
                        <motion.h2
                            initial={{ opacity: 0, y: 10 }}
                            animate={isActive ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="text-[1.5rem] leading-[1.2] md:text-5xl lg:text-6xl font-black text-white tracking-wide uppercase font-mono line-clamp-5"
                        >
                            {item.title}
                        </motion.h2>
                        
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={isActive ? { width: '40px' } : {}}
                            transition={{ delay: 0.1, duration: 0.3 }}
                            className="h-1 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
                        />
                    </div>
 
                    {/* Summary Section */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={isActive ? { opacity: 1 } : {}}
                        transition={{ delay: 0.2, duration: 0.3 }}
                        className="relative mt-1 pl-4 cursor-pointer group/summary flex-1 min-h-0 overflow-hidden"
                        onClick={handleReadMoreClick}
                    >
                        <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-emerald-500/50 group-hover/summary:bg-emerald-500 transition-all"></div>
                        <p className="text-[13px] md:text-xl text-zinc-400 md:text-zinc-300 font-mono italic font-light leading-relaxed tracking-wide line-clamp-6 overflow-hidden">
                            "{item.summary}"
                        </p>
                    </motion.div>
 
                    {/* Source Attribution */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={isActive ? { opacity: 1 } : {}}
                        transition={{ delay: 0.3 }}
                        className="flex items-center gap-3 mt-1"
                    >
                        <span className="text-[8px] md:text-[10px] font-bold tracking-[0.2em] text-emerald-400/80 uppercase truncate">
                            SOURCE <span className="text-emerald-500/30 mx-1">//</span> {cleanSource}
                        </span>
                    </motion.div>
                </div>

                <div className="flex flex-col items-center gap-4 shrink-0">
                    {/* Circular Image - Performance optimized radar */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={isActive ? { opacity: 1, scale: 1 } : {}}
                        transition={{ delay: 0.4, duration: 0.3 }}
                        className="w-20 h-20 md:w-40 md:h-40 rounded-full overflow-hidden border border-emerald-500/20 relative shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                    >
                        {item.image ? (
                            <img src={item.image} alt="Intelligence visual" className="w-full h-full object-cover filter grayscale" loading="lazy" />
                        ) : (
                            <div className="w-full h-full bg-[#0a1510] flex items-center justify-center">
                                <Globe className="w-6 h-6 text-emerald-500/20" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)] z-10"></div>
                        <div className="absolute top-1/2 left-1/2 w-full h-[0.5px] bg-emerald-500/30 origin-left animate-[spin_8s_linear_infinite] z-20"></div>
                    </motion.div>

                    {/* Interactive Footer Row */}
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={isActive ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.5, duration: 0.2 }}
                        className="flex items-center gap-2 w-full max-w-sm"
                    >
                        <button
                            onClick={handleReadMoreClick}
                            className="flex-1 h-12 bg-emerald-500 text-black active:bg-emerald-400 transition-all flex items-center justify-center gap-3 rounded-sm font-black text-[10px] uppercase tracking-[0.2em] pointer-events-auto"
                        >
                            <BookOpen className="w-3.5 h-3.5" />
                            ACCESS_INTEL
                        </button>
                        
                        <button
                            onClick={handleShareClick}
                            className="w-12 h-12 bg-black/40 border border-emerald-500/30 flex items-center justify-center text-emerald-500 active:bg-emerald-500/10 rounded-sm pointer-events-auto"
                        >
                            <Share2 className="w-3.5 h-3.5" />
                        </button>
                    </motion.div>
                </div>
            </div>

            <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent pointer-events-none" />
        </div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.isActive === nextProps.isActive &&
        prevProps.item.id === nextProps.item.id &&
        prevProps.item.isLiked === nextProps.item.isLiked &&
        prevProps.category === nextProps.category
    );
});
