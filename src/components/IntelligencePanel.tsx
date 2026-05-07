
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain, ExternalLink, Shield } from 'lucide-react';
import { NewsItem } from '@/types/news';

interface IntelligencePanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNews: NewsItem | null;
  aiAnalysis: { meaning: string; impact: string } | null;
  isAiLoading: boolean;
  extractKeyPoints: (text: string) => string[];
}

export const IntelligencePanel = ({ 
  isOpen, 
  onClose, 
  selectedNews, 
  aiAnalysis, 
  isAiLoading,
  extractKeyPoints
}: IntelligencePanelProps) => {
  if (!selectedNews) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] bg-[#020504] flex flex-col"
        >
          {/* Header Táctico del Modal */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <div className="text-[10px] font-black text-emerald-500 tracking-[0.2em] uppercase">Expediente_Abierto</div>
                <div className="text-[8px] font-mono text-white/30 uppercase tracking-widest">ID: {selectedNews.id.substring(0, 8)} // {selectedNews.source}</div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <motion.div 
            className="flex-1 overflow-y-auto no-scrollbar pb-24"
            initial={{ y: 20 }}
            animate={{ y: 0 }}
          >
            <div className="max-w-4xl mx-auto p-6 md:p-12 space-y-12">
              {selectedNews.image && (
                <div className="w-full aspect-video rounded-[40px] overflow-hidden border border-white/10 shadow-2xl">
                  <img src={selectedNews.image} className="w-full h-full object-cover" alt="" />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="md:col-span-2 space-y-12">
                  {/* Tactical Analysis Block */}
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

                  <div className="space-y-8 mt-12">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                      <div className="w-2 h-2 rounded-full bg-emerald-500/50"></div>
                      <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-white/50">Contexto_Original</h3>
                    </div>
                    
                    <div className="text-lg md:text-xl text-zinc-300 font-sans font-light leading-relaxed space-y-6">
                      {selectedNews.content && selectedNews.content !== 'Contenido restringido.' ? (
                        selectedNews.content
                          .replace(/^\*\*.*?\*\*/, '')
                          .split('\n')
                          .map((p, i) => {
                            const trimmed = p.trim();
                            if (!trimmed) return null;
                            if (trimmed.includes('### Fuentes') || trimmed.toLowerCase() === 'fuentes consultadas' || trimmed === 'Fuentes:') {
                              return <h4 key={i} className="text-sm font-mono text-emerald-500/80 mt-12 mb-4 uppercase tracking-wider border-b border-white/5 pb-2">Fuentes Consultadas</h4>;
                            }
                            return <p key={i} className="text-zinc-300/90">{trimmed}</p>;
                          })
                      ) : (
                        <p className="text-zinc-500 italic font-mono text-sm">No se ha podido recuperar el cuerpo completo de esta noticia. Solo se dispone del informe de inteligencia.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="p-8 bg-white/5 border border-white/10 rounded-[32px] space-y-8 sticky top-24">
                    <div className="flex items-center justify-between text-emerald-400">
                      <div className="flex items-center gap-3">
                        <Brain className={`w-5 h-5 ${isAiLoading ? 'animate-pulse' : ''}`} />
                        <span className="text-[12px] font-black uppercase tracking-[0.2em]">Analysis_Veridian</span>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {isAiLoading ? (
                        <div className="space-y-4 animate-pulse">
                          <div className="h-4 bg-white/5 rounded w-3/4" />
                          <div className="h-4 bg-white/5 rounded w-full" />
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
                            <div className="text-[9px] font-black text-orange-500/60 uppercase tracking-widest flex items-center gap-2">¿Cómo afecta?</div>
                            <div className="space-y-4 border-l border-orange-500/20 pl-4">
                              {typeof aiAnalysis.impact === 'string' && aiAnalysis.impact.split(/[-•]/).map(p => p.trim()).filter(Boolean).map((point, idx) => (
                                <div key={idx} className="flex gap-3 items-start">
                                  <div className="mt-1.5 w-1.5 h-1.5 rotate-45 bg-orange-500/30 shrink-0" />
                                  <span className="text-[13px] text-zinc-300 leading-tight font-light">{point}</span>
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
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
