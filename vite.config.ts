import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Plugin para excluir archivos de API del procesamiento de Vite
const excludeApiPlugin = () => ({
  name: 'exclude-api',
  resolveId(id: string) {
    if (id.includes('/api/') || id.includes('\\api\\') || id === 'googleapis' || id === '@vercel/node') {
      return { id, external: true };
    }
    return null;
  },
  load(id: string) {
    if (id.includes('/api/') || id.includes('\\api\\')) {
      return 'export {}';
    }
    return null;
  }
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    },
    // Middleware para manejar el fallback de rutas en /veridian-news y /noticias
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url && (req.url === '/veridian-news' || req.url.startsWith('/veridian-news/')) && !req.url.includes('.')) {
          req.url = '/index.html';
        } else if (req.url && (req.url === '/noticias' || req.url.startsWith('/noticias/')) && !req.url.includes('.')) {
          req.url = '/index.html';
        }
        next();
      });
    }
  },
  plugins: [
    excludeApiPlugin(),
    react()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@landing": path.resolve(__dirname, "./landing"),
      "@news": path.resolve(__dirname, "./src"),
      "@integrations": path.resolve(__dirname, "./integrations"),
    },
  },
  optimizeDeps: {
    exclude: ['googleapis', '@vercel/node'],
  },
  publicDir: 'public',
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        "veridian-news": path.resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['framer-motion', 'lucide-react', 'clsx', 'tailwind-merge'],
          'vendor-supabase': ['@supabase/supabase-js'],
        }
      },
      external: (id) => {
        if (id.includes('/api/') || id.includes('\\api\\') || id.startsWith('./api/') || id.startsWith('../api/') || id.includes('api/news')) {
          return true;
        }
        if (id === 'googleapis' || id === '@vercel/node') {
          return true;
        }
        return false;
      },
    },
  },
}));
