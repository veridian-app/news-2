import { useState, useRef, useEffect } from "react";
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

export const NewsCard = ({ item, isActive, index, onLike, onShare, onReadMore, category }: NewsCardProps) => {
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
            className="relative h-[100dvh] w-full snap-start snap-always overflow-hidden bg-[#020504] select-none font-mono flex items-center justify-center"
            onClick={handleTap}
        >
            <DoubleTapOverlay showLike={showDoubleTapHeart} position={tapPosition} />

            {/* Premium Background Effects */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Mesh Gradient */}
                <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] opacity-20" style={{
                    background: 'radial-gradient(circle at 50% 50%, #10B981 0%, transparent 50%), radial-gradient(circle at 80% 20%, #065F46 0%, transparent 40%)',
                    filter: 'blur(80px)'
                }} />
                
                {/* Fine Grid */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }} />

                {/* Scanlines Effect */}
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
            </div>

            {/* Content Container - Centered and Professional */}
            <div className="relative w-full h-full flex flex-col justify-between px-6 md:px-12 pt-16 pb-8 md:py-24 z-10 max-w-4xl mx-auto">
                
                <div className="flex flex-col gap-4 md:gap-6">
                    {/* Meta Top Bar */}
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={isActive ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.1, duration: 0.4 }}
                        className="flex items-center justify-between mt-2 md:mt-10"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-3 py-1 border border-emerald-500/40 rounded-sm bg-emerald-500/5">
                                <Shield className="w-3 h-3 text-emerald-500" />
                                <span className="text-[9px] md:text-[10px] text-emerald-400 font-bold tracking-[0.2em]">{displayCategory}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 border border-emerald-500/20 bg-black/40 rounded-sm text-emerald-500/70 text-[9px] md:text-[10px] font-bold tracking-widest">
                            <Clock className="w-3 h-3" />
                            {dateStr}
                            <div className="w-1.5 h-1.5 ml-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        </div>
                    </motion.div>
 
                    {/* Main Headline */}
                    <div className="flex flex-col gap-4 md:gap-6 mt-1 md:mt-4">
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            animate={isActive ? { opacity: 1, y: 0 } : {}}
                            transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            className="text-[1.75rem] md:text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-wide uppercase font-mono"
                            style={{ textShadow: '0 0 40px rgba(255,255,255,0.1)' }}
                        >
                            {item.title}
                        </motion.h2>
                        
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={isActive ? { width: '80px' } : {}}
                            transition={{ delay: 0.4, duration: 0.8 }}
                            className="h-1 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]"
                        />
                    </div>
 
                    {/* Summary Section (Quote Style) */}
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={isActive ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 0.5, duration: 0.5 }}
                        className="relative mt-1 md:mt-2 pl-4 md:pl-6 cursor-pointer group/summary"
                        onClick={handleReadMoreClick}
                    >
                        <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] group-hover/summary:w-1 transition-all"></div>
                        <p className="text-sm md:text-xl text-zinc-400 md:text-zinc-300 font-mono italic font-light leading-relaxed tracking-wide line-clamp-4 md:line-clamp-none">
                            "{item.summary && item.summary.length > 180 ? item.summary.substring(0, 180).trim() + '...' : item.summary}"
                        </p>
                    </motion.div>
 
                    {/* Source Attribution */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={isActive ? { opacity: 1 } : {}}
                        transition={{ delay: 0.6 }}
                        className="flex items-center gap-3 mt-2 md:mt-4"
                    >
                        <span className="text-[9px] md:text-[10px] font-bold tracking-[0.3em] text-emerald-400 uppercase">
                            SOURCE <span className="text-emerald-500/50 mx-2">//</span> {cleanSource} <span className="text-emerald-500/50 mx-2">/</span> VERIDIAN
                        </span>
                    </motion.div>
                </div>

                <div className="flex flex-col items-center justify-end gap-8 mt-auto mb-6">
                    {/* Circular Image */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={isActive ? { opacity: 1, scale: 1 } : {}}
                        transition={{ delay: 0.7, duration: 0.6, type: "spring" }}
                        className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-2 border-emerald-500/30 relative shadow-[0_0_30px_rgba(16,185,129,0.15)]"
                    >
                        <div className="absolute inset-0 bg-emerald-500/10 z-10 mix-blend-overlay"></div>
                        <div className="absolute inset-0 border border-emerald-500/50 rounded-full z-20 m-1"></div>
                        {item.image ? (
                            <img src={item.image} alt="Intelligence visual" className="w-full h-full object-cover filter grayscale sepia-[0.2] hue-rotate-[140deg]" />
                        ) : (
                            <div className="w-full h-full bg-[#0a1510] flex items-center justify-center">
                                <Globe className="w-10 h-10 text-emerald-500/30" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] z-10"></div>
                        {/* Radar line effect */}
                        <div className="absolute top-1/2 left-1/2 w-full h-[1px] bg-emerald-500/40 origin-left animate-[spin_4s_linear_infinite] z-20"></div>
                    </motion.div>

                    {/* Interactive Footer Row */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={isActive ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.8, duration: 0.5 }}
                        className="flex items-center gap-2 w-full"
                    >
                        <button
                            onClick={handleReadMoreClick}
                            className="flex-1 h-14 bg-emerald-500 text-black hover:bg-emerald-400 transition-all flex items-center justify-center gap-3 rounded-sm font-black text-[11px] uppercase tracking-[0.2em] pointer-events-auto active:scale-[0.98] shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                        >
                            <BookOpen className="w-4 h-4" />
                            ACCESS_INTEL
                        </button>
                        
                        <button
                            onClick={handleShareClick}
                            className="w-14 h-14 bg-black/40 border border-emerald-500/30 flex items-center justify-center text-emerald-500 transition-all rounded-sm pointer-events-auto active:scale-[0.95] hover:bg-emerald-500/10"
                        >
                            <Share2 className="w-4 h-4" />
                        </button>
                    </motion.div>
                </div>
            </div>

            <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent pointer-events-none" />
        </div>
    );
};
