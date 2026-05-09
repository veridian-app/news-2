import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { mixpanelTrack } from "@/lib/mixpanel";
import { createPortal } from "react-dom";

export const SearchOverlay = () => {
  const { searchQuery, setSearchQuery, showSearchModal, closeSearch } = useSearch();
  const [localQuery, setLocalQuery] = useState(searchQuery);

  // Sincronizar local con global y trackear
  useEffect(() => {
    setLocalQuery(searchQuery);
    if (showSearchModal) {
      mixpanelTrack('Search_Modal_Opened');
    }
  }, [searchQuery, showSearchModal]);

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

  return createPortal(
    <AnimatePresence>
      {showSearchModal && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-[5dvh] sm:pt-[10vh] px-4 sm:px-6 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            key="search-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSearch}
            className="absolute inset-0 bg-black/95 backdrop-blur-2xl"
          />

          {/* Modal Content */}
          <motion.div
            key="search-content"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full max-w-2xl bg-[#0a0f0d] border border-emerald-500/30 rounded-3xl shadow-[0_0_150px_rgba(16,185,129,0.4)] overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="p-5 sm:p-8 flex flex-col h-full">
              <form onSubmit={handleSubmit} className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-emerald-500" />
                <input
                  autoFocus
                  type="text"
                  placeholder="BUSCAR_INTELIGENCIA..."
                  value={localQuery}
                  onChange={(e) => {
                    setLocalQuery(e.target.value);
                    setSearchQuery(e.target.value);
                  }}
                  className="w-full bg-white/5 border border-emerald-500/20 rounded-2xl py-5 pl-14 pr-14 text-emerald-50 text-base placeholder:text-emerald-500/40 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={closeSearch}
                  className="absolute right-5 top-1/2 -translate-y-1/2 p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </form>

              <div className="mt-10 overflow-y-auto no-scrollbar">
                <div className="flex items-center gap-3 mb-6">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.3em]">Nodos_Populares</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setLocalQuery(suggestion);
                        setSearchQuery(suggestion);
                        closeSearch();
                      }}
                      className="px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-[11px] text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all font-mono text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-auto pt-8 border-t border-white/5 flex items-center justify-between text-white/20">
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4" />
                  <span className="text-[10px] font-mono uppercase tracking-widest">Search_Engine_Active</span>
                </div>
                <button 
                  onClick={closeSearch}
                  className="text-[10px] font-mono uppercase tracking-widest hover:text-emerald-500 transition-colors"
                >
                  Cerrar_Terminal [ESC]
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
