import { Home, LayoutGrid, Search, Coffee, Brain, Bookmark, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useDockVisibility } from "@/contexts/DockVisibilityContext";
import { useSearch } from "@/contexts/SearchContext";
import { motion, AnimatePresence } from "framer-motion";

const DockItem = ({ icon, path, isActive }: { icon: React.ReactNode, path: string, isActive: boolean }) => (
  <Link to={path} className={cn(
    "relative p-1.5 transition-all duration-300",
    isActive ? "text-white scale-110" : "text-white/40 hover:text-white/80"
  )}>
    {icon}
    {isActive && (
      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-500 rounded-full shadow-[0_0_6px_2px_rgba(16,185,129,0.5)]" />
    )}
  </Link>
);

// Botón de búsqueda que abre el modal
const SearchButton = ({ isActive }: { isActive: boolean }) => {
  const { openSearch, searchQuery } = useSearch();

  return (
    <button
      onClick={openSearch}
      className={cn(
        "relative p-1.5 transition-all duration-300",
        isActive || searchQuery ? "text-white scale-110" : "text-white/40 hover:text-white/80"
      )}
    >
      <Search size={20} />
      {(isActive || searchQuery) && (
        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-500 rounded-full shadow-[0_0_6px_2px_rgba(16,185,129,0.5)]" />
      )}
    </button>
  );
};

export const BottomDock = () => {
  const location = useLocation();
  const { isVisible } = useDockVisibility();
  const { showSearchModal } = useSearch();

  const isActive = (path: string) => {
    if (path === "/" && location.pathname !== "/") return false;
    return location.pathname.startsWith(path);
  };

  const isCafeActive = isActive("/cafe");
  const isProfileActive = isActive("/profile");

  return (
    <>


      {/* Bottom dock */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-3 inset-x-0 z-50 flex justify-center pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-center justify-between px-6 py-2.5 bg-black/50 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl min-w-[280px] max-w-[360px] gap-2">
              <DockItem icon={<Home size={22} />} path="/" isActive={location.pathname === "/" || location.pathname === "/veridian-news"} />
              <SearchButton isActive={showSearchModal} />

              {/* Central Café Button */}
              <Link
                to="/cafe"
                className={cn(
                  "relative flex items-center justify-center w-12 h-12 bg-gradient-to-tr from-green-600 to-emerald-500 rounded-full shadow-lg shadow-green-900/50 active:scale-95 transition-transform mx-2",
                  isCafeActive && "scale-110 ring-2 ring-emerald-400/50"
                )}
              >
                <Coffee className="text-white" size={20} />
                {isCafeActive && (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-500 rounded-full shadow-[0_0_6px_2px_rgba(16,185,129,0.5)]" />
                )}
              </Link>

              <DockItem icon={<LayoutGrid size={22} />} path="/categorias" isActive={isActive("/categorias")} />
              <DockItem icon={<User size={22} />} path="/profile" isActive={isActive("/profile")} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
