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
    isLiked: boolean;
    index: number;
    onLike: () => void;
    onShare: () => void;
    onReadMore: () => void;
    category?: string;
}

export const NewsCard = memo(({ item, isActive, isLiked, index, onLike, onShare, onReadMore, category }: NewsCardProps) => {
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
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative h-full w-full bg-[#020504] select-none font-mono flex items-center justify-center overflow-hidden"
            onClick={handleTap}
            style={{ 
              willChange: 'transform, opacity',
              transform: 'translate3d(0,0,0)'
            }}
        >
            <DoubleTapOverlay showLike={showDoubleTapHeart} position={tapPosition} />

            {/* Ultra-Fast Background Layer */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute inset-0 opacity-[0.1]" style={{
                    background: 'radial-gradient(circle at 50% 50%, #10B981 0%, transparent 80%)',
                    filter: 'blur(40px)',
                    transform: 'translateZ(0)'
                }} />
                <div className="absolute inset-0 opacity-[0.015]" style={{
                    backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                    transform: 'translateZ(0)'
                }} />
            </div>

            {/* Content Container - Zero-lag Layout */}
            <div className="relative w-full h-full flex flex-col justify-between gap-2 px-6 md:px-12 pt-40 pb-28 md:pt-48 md:pb-32 z-10 max-w-4xl mx-auto overflow-hidden">
                
                <div className="flex flex-col gap-3 md:gap-6 flex-1 min-h-0">
                    {/* Meta Top Bar */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={isActive ? { opacity: 1 } : {}}
                        transition={{ duration: 0.15 }}
                        className="flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-2 py-0.5 border border-emerald-500/40 rounded-sm bg-emerald-500/10">
                                <Shield className="w-2.5 h-2.5 text-emerald-500" />
                                <span className="text-[9px] md:text-[11px] text-emerald-400 font-black tracking-[0.2em]">{displayCategory}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-0.5 border border-emerald-500/20 bg-black/60 rounded-sm text-emerald-500/80 text-[8px] md:text-[11px] font-bold tracking-widest">
                            <Clock className="w-2.5 h-2.5" />
                            {dateStr}
                        </div>
                    </motion.div>
 
                    {/* Main Headline */}
                    <div className="flex flex-col gap-2 md:gap-6">
                        <motion.h2
                            initial={{ opacity: 0, y: 15 }}
                            animate={isActive ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                            className="text-[1.6rem] leading-[1.15] md:text-5xl lg:text-7xl font-black text-white tracking-tight uppercase font-mono line-clamp-5 drop-shadow-2xl"
                        >
                            {item.title}
                        </motion.h2>
                        
                        <motion.div 
                            initial={{ scaleX: 0, originX: 0 }}
                            animate={isActive ? { scaleX: 1 } : {}}
                            transition={{ delay: 0.1, duration: 0.3 }}
                            className="h-1 w-12 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]"
                        />
                    </div>
 
                    {/* Summary Section */}
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={isActive ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 0.15, duration: 0.3 }}
                        className="relative mt-2 pl-4 cursor-pointer group/summary flex-1 min-h-0 overflow-hidden"
                        onClick={handleReadMoreClick}
                    >
                        <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-emerald-500/60 group-hover/summary:bg-emerald-500 transition-colors"></div>
                        <p className="text-[14px] md:text-2xl text-zinc-300 font-mono italic font-light leading-snug tracking-normal line-clamp-6 overflow-hidden">
                            "{item.summary}"
                        </p>
                    </motion.div>
 
                    {/* Source Attribution */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={isActive ? { opacity: 1 } : {}}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-3 mt-1"
                    >
                        <span className="text-[9px] md:text-[11px] font-black tracking-[0.25em] text-emerald-500/90 uppercase truncate">
                            Fuente <span className="text-emerald-500/20 mx-1">//</span> {cleanSource}
                        </span>
                    </motion.div>
                </div>

                <div className="flex flex-col items-center gap-5 shrink-0">
                    {/* Circular Image - Performance-first radar */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={isActive ? { opacity: 1, scale: 1 } : {}}
                        transition={{ delay: 0.25, duration: 0.3, type: "spring", damping: 20 }}
                        className="w-24 h-24 md:w-48 md:h-48 rounded-full overflow-hidden border border-emerald-500/30 relative shadow-[0_0_40px_rgba(16,185,129,0.15)] bg-black"
                    >
                        {item.image ? (
                            <NewsImage 
                                src={item.image} 
                                alt="Intel Visual" 
                                className="w-full h-full grayscale brightness-75 contrast-125" 
                                priority={isActive}
                            />
                        ) : (
                            <div className="w-full h-full bg-[#0a1510] flex items-center justify-center">
                                <Globe className="w-8 h-8 text-emerald-500/30" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.7)_100%)] z-10"></div>
                        <div className="absolute top-1/2 left-1/2 w-full h-[1px] bg-emerald-400/40 origin-left animate-[spin_10s_linear_infinite] z-20 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
                    </motion.div>

                    {/* Interactive Footer Row */}
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={isActive ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.3, duration: 0.2 }}
                        className="flex items-center gap-3 w-full max-w-sm px-2"
                    >
                        <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={handleReadMoreClick}
                            className="flex-1 h-14 bg-emerald-500 text-black active:bg-emerald-400 transition-colors flex items-center justify-center gap-3 rounded-sm font-black text-[11px] uppercase tracking-[0.25em] pointer-events-auto shadow-[0_8px_20px_rgba(16,185,129,0.2)]"
                        >
                            <BookOpen className="w-4 h-4" />
                            LEER NOTICIA
                        </motion.button>
                        
                        <motion.button
                            whileTap={{ scale: 0.92 }}
                            onClick={handleShareClick}
                            className="w-14 h-14 bg-black/60 border border-emerald-500/30 flex items-center justify-center text-emerald-500 active:bg-emerald-500/20 rounded-sm pointer-events-auto backdrop-blur-md"
                        >
                            <Share2 className="w-4 h-4" />
                        </motion.button>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.isActive === nextProps.isActive &&
        prevProps.isLiked === nextProps.isLiked &&
        prevProps.item.id === nextProps.item.id &&
        prevProps.category === nextProps.category
    );
});
