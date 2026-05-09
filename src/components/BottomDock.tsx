import { Home, LayoutGrid, Search, Coffee, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useDockVisibility } from "@/contexts/DockVisibilityContext";
import { useSearch } from "@/contexts/SearchContext";
import { motion, AnimatePresence } from "framer-motion";

const DockItem = ({ icon, path, isActive }: { icon: React.ReactNode, path: string, isActive: boolean }) => (
  <Link to={path} className={cn(
    "relative flex flex-col items-center justify-center p-2 transition-all duration-300 active:scale-90",
    isActive ? "text-emerald-400 scale-110" : "text-white/40 hover:text-white/80"
  )}>
    {icon}
    {isActive && (
      <motion.span 
        layoutId="active-dot"
        className="absolute -bottom-1 w-1 h-1 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]" 
      />
    )}
  </Link>
);

const SearchButton = ({ isActive }: { isActive: boolean }) => {
  const { openSearch, searchQuery } = useSearch();

  return (
    <button
      onClick={openSearch}
      className={cn(
        "relative flex flex-col items-center justify-center p-2 transition-all duration-300 active:scale-90",
        isActive || searchQuery ? "text-emerald-400 scale-110" : "text-white/40 hover:text-white/80"
      )}
    >
      <Search size={22} />
      {(isActive || searchQuery) && (
        <motion.span 
          layoutId="active-dot"
          className="absolute -bottom-1 w-1 h-1 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]" 
        />
      )}
    </button>
  );
};

export const BottomDock = () => {
  const location = useLocation();
  const { isVisible } = useDockVisibility();
  const { showSearchModal } = useSearch();

  const isActive = (path: string) => {
    if (path === "/" && location.pathname !== "/" && location.pathname !== "/veridian-news") return false;
    if (path === "/" && (location.pathname === "/" || location.pathname === "/veridian-news")) return true;
    return location.pathname.startsWith(path);
  };

  const isHomeActive = isActive("/");
  const isCafeActive = isActive("/cafe");
  const isCategoriesActive = isActive("/categorias");
  const isProfileActive = isActive("/profile");

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-10 inset-x-0 z-[100] flex justify-center px-4"
        >
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 backdrop-blur-2xl border border-white/5 rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] min-w-[320px] max-w-[400px] w-full gap-2">
            <DockItem 
              icon={<Home size={24} />} 
              path="/veridian-news" 
              isActive={isHomeActive} 
            />
            
            <SearchButton isActive={showSearchModal} />

            {/* Central Café Button */}
            <div className="relative -top-1">
              <Link
                to="/cafe"
                className={cn(
                  "relative flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-full shadow-[0_8px_20px_rgba(16,185,129,0.3)] active:scale-90 transition-all duration-300",
                  isCafeActive ? "scale-110 shadow-[0_0_25px_rgba(16,185,129,0.5)]" : "hover:bg-emerald-400"
                )}
              >
                <Coffee className="text-black" size={28} strokeWidth={2.5} />
              </Link>
            </div>

            <DockItem 
              icon={<LayoutGrid size={24} />} 
              path="/categorias" 
              isActive={isCategoriesActive} 
            />
            
            <DockItem 
              icon={<User size={24} />} 
              path="/profile" 
              isActive={isProfileActive} 
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
