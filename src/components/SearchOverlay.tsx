import { useEffect, useState } from "react";
import { Search, X, Zap, Clock, TrendingUp } from "lucide-react";
import { useSearch } from "@/contexts/SearchContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export const SearchOverlay = () => {
  const { searchQuery, setSearchQuery, showSearchModal, closeSearch } = useSearch();
  const [localQuery, setLocalQuery] = useState(searchQuery);

  // Sincronizar local con global
  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  // Manejar el submit (tecla Enter)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localQuery);
    closeSearch();
  };

  // Sugerencias tácticas
  const suggestions = [
    "Geopolítica",
    "Tecnología",
    "España",
    "Inteligencia Artificial",
    "Economía Global"
  ];

  return (
    <AnimatePresence>
      {showSearchModal && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4 sm:px-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSearch}
            className="absolute inset-0 bg-[#020504]/80 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="relative w-full max-w-2xl bg-[#0a0f0d] border border-emerald-500/20 rounded-2xl shadow-[0_0_50px_rgba(16,185,129,0.1)] overflow-hidden"
          >
            <div className="p-4 sm:p-6">
              <form onSubmit={handleSubmit} className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500/50" />
                <input
                  autoFocus
                  type="text"
                  placeholder="BUSCAR_NOTICIAS_O_EVENTOS..."
                  value={localQuery}
                  onChange={(e) => {
                    setLocalQuery(e.target.value);
                    // Búsqueda en tiempo real si se desea
                    setSearchQuery(e.target.value);
                  }}
                  className="w-full bg-white/5 border border-emerald-500/10 rounded-xl py-4 pl-12 pr-12 text-emerald-100 placeholder:text-emerald-500/30 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/40 transition-all font-mono text-sm"
                />
                {localQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalQuery("");
                      setSearchQuery("");
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/5 rounded-md text-emerald-500/50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </form>

              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-3 h-3 text-emerald-500/40" />
                  <span className="text-[10px] font-black text-emerald-500/40 uppercase tracking-[0.2em]">Tendencias_Tácticas</span>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setLocalQuery(suggestion);
                        setSearchQuery(suggestion);
                        closeSearch();
                      }}
                      className="px-4 py-2 bg-white/5 border border-emerald-500/5 rounded-lg text-xs text-emerald-500/60 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all font-medium"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-emerald-500/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-orange-500/50" />
                  <span className="text-[8px] font-mono text-emerald-500/20 uppercase tracking-widest">Veridian_Search_Core_v2.1</span>
                </div>
                <div className="flex items-center gap-3">
                   <span className="text-[8px] font-mono text-emerald-500/20 uppercase">Presiona [Enter] para confirmar</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
