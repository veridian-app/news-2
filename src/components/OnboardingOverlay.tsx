
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield } from 'lucide-react';

interface OnboardingOverlayProps {
  show: boolean;
  onComplete: () => void;
}

export const OnboardingOverlay = ({ show, onComplete }: OnboardingOverlayProps) => {
  return (
    <AnimatePresence>
      {show && (
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
          >
            <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
              <Shield className="w-10 h-10 text-emerald-500" />
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic mb-2">SISTEMA_ACTIVO</h3>
            <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
              Nodo central Veridian sincronizado. Desliza para navegar por el feed táctico.
            </p>
            <button
              onClick={onComplete}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-all shadow-lg shadow-emerald-500/20"
            >
              Entendido_Operador
            </button>
            
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
  );
};
