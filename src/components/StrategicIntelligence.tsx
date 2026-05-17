import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StrategicItem } from '@/types/news';
import { Shield, Zap, AlertTriangle, Globe, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StrategicIntelligenceProps {
  onSelect?: (item: StrategicItem) => void;
}

export const StrategicIntelligence: React.FC<StrategicIntelligenceProps> = ({ onSelect }) => {
  const [intel, setIntel] = useState<StrategicItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const fetchIntel = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('strategic_intelligence')
          .select('*')
          .order('published_at', { ascending: false })
          .limit(5);

        if (error) {
          // Si la tabla no existe, fallará silenciosamente
          console.warn('Strategic Intelligence table not found or error:', error.message);
          return;
        }

        if (data && data.length > 0) {
          setIntel(data);
          setIsVisible(true);
        }
      } catch (e) {
        console.error('Error fetching strategic intel:', e);
      }
    };

    fetchIntel();
  }, []);

  useEffect(() => {
    if (intel.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % intel.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [intel]);

  if (!isVisible || intel.length === 0) return null;

  const currentItem = intel[currentIndex];

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'CRITICAL': return 'text-red-500';
      case 'ALERTA': return 'text-orange-500';
      case 'ELEVATED': return 'text-yellow-500';
      default: return 'text-emerald-500';
    }
  };

  const getStatusBg = (status?: string) => {
    switch (status) {
      case 'CRITICAL': return 'bg-red-500/10 border-red-500/20';
      case 'ALERTA': return 'bg-orange-500/10 border-orange-500/20';
      case 'ELEVATED': return 'bg-yellow-500/10 border-yellow-500/20';
      default: return 'bg-emerald-500/10 border-emerald-500/20';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 py-2"
    >
      <div 
        onClick={() => onSelect?.(currentItem)}
        className={cn(
          "relative overflow-hidden rounded-lg border backdrop-blur-md transition-colors duration-500 cursor-pointer active:scale-[0.98] transition-transform",
          getStatusBg(currentItem.threat_status)
        )}
      >
        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 h-[1px] bg-white/20 w-full overflow-hidden">
          <motion.div 
            key={currentIndex}
            initial={{ x: '-100%' }}
            animate={{ x: '0%' }}
            transition={{ duration: 8, ease: "linear" }}
            className={cn("h-full", getStatusColor(currentItem.threat_status).replace('text-', 'bg-'))}
          />
        </div>

        <div className="p-3 flex items-start gap-3">
          <div className={cn(
            "p-2 rounded-md bg-black/40 border border-white/5",
            getStatusColor(currentItem.threat_status)
          )}>
            {currentItem.threat_status === 'CRITICAL' ? <AlertTriangle size={18} /> : <Shield size={18} />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-[9px] font-black uppercase tracking-widest", getStatusColor(currentItem.threat_status))}>
                Inteligencia_Estratégica // {currentItem.threat_status || 'STABLE'}
              </span>
              <span className="text-[9px] text-white/20">•</span>
              <span className="text-[9px] text-white/40 font-mono uppercase tracking-tighter flex items-center gap-1">
                <Globe size={10} /> {currentItem.region || 'GLOBAL'}
              </span>
            </div>

            <AnimatePresence mode="wait">
              <motion.h3 
                key={currentItem.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-xs font-bold text-white leading-tight line-clamp-1"
              >
                {currentItem.title}
              </motion.h3>
            </AnimatePresence>
          </div>

          <div className="self-center p-1">
            <ChevronRight size={16} className="text-white/40" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
