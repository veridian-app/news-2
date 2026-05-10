import React, { useState, useEffect } from 'react';
import { Mail, Lock, Shield, ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Button } from "../components/ui/button";
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const VeridianLanding = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { user, isAuthenticated, isLoading: isAuthLoading, signInWithMagicLink, signInWithGoogle, signInWithPassword, resetPasswordForEmail } = auth;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // Si ya estamos autenticados, no mostramos nada y vamos directo a noticias
    if (isAuthenticated && !isAuthLoading) {
      navigate('/veridian-news');
    }
  }, [isAuthenticated, isAuthLoading, navigate]);

  // Si el sistema de Auth está cargando la sesión inicial, mostramos la pantalla táctica de carga
  if (isAuthLoading || isRedirecting) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
        <div className="noise-overlay" />
        <div className="scanline" />
        <div className="tactical-grid absolute inset-0 opacity-[0.03]" />
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="w-16 h-16 border-t-2 border-emerald-500 rounded-full animate-spin shadow-[0_0_20px_rgba(16,185,129,0.3)]" />
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-[0.5em] animate-pulse">
              {isRedirecting ? 'Autorizando...' : 'Cargando...'}
            </span>
            <div className="w-48 h-0.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-emerald-500"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const handleGoogleLogin = async () => {
    if (isLoading || isRedirecting) return;
    
    setIsLoading(true);
    setIsRedirecting(true); // Bloqueo total inmediato
    setError(null);
    
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
      // El navegador se redireccionará solo a Google
    } catch (err: any) {
      console.error("Google login error:", err);
      setError(err.message);
      setIsLoading(false);
      setIsRedirecting(false);
      toast.error("ERROR_GOOGLE", { description: "Fallo en el protocolo de enlace." });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isRedirecting) return;

    // Validación de contraseña
    if (password) {
      if (password.length < 8) {
        toast.error("Contraseña muy corta", { description: "La contraseña debe tener al menos 8 caracteres." });
        return;
      }
      if (!/[A-Z]/.test(password)) {
        toast.error("Falta mayúscula", { description: "La contraseña debe contener al menos una letra mayúscula." });
        return;
      }
      if (!/[0-9!@#$%^&*]/.test(password)) {
        toast.error("Falta carácter especial o número", { description: "La contraseña debe contener al menos un número o carácter especial." });
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      if (password) {
        const { error: loginError } = await signInWithPassword(email.trim(), password);
        if (loginError) {
          setError("Acceso Denegado. Credenciales Inválidas.");
          toast.error("Error de acceso", { description: "Verifica tu email y contraseña." });
          setIsLoading(false);
        } else {
          setIsRedirecting(true); // Bloqueo total tras éxito
          toast.success("Acceso concedido", { description: "Entrando en Veridian..." });
        }
      } else {
        const { error: magicError } = await signInWithMagicLink(email.trim());
        if (magicError) {
          setError(magicError.message);
          toast.error("Error de enlace", { description: magicError.message });
          setIsLoading(false);
        } else {
          setIsSent(true);
          toast.success("Enlace enviado", { description: "Revisa tu bandeja de entrada." });
          setIsLoading(false);
        }
      }
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Email requerido", { description: "Introduce tu email para restablecer la contraseña." });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await resetPasswordForEmail(email.trim());
      if (error) toast.error("Error", { description: error.message });
      else toast.success("Enviado", { description: "Instrucciones enviadas a tu email." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-emerald-500/30 selection:text-emerald-400 overflow-hidden flex flex-col relative">
      {/* Global Overlays */}
      <div className="noise-overlay" />
      <div className="scanline" />
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.05, 0.1, 0.05] 
          }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500 blur-[150px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.05, 0.08, 0.05] 
          }}
          transition={{ duration: 15, repeat: Infinity, delay: 2 }}
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-500 blur-[150px]" 
        />
        <div className="absolute inset-0 tactical-grid opacity-[0.03]" />
      </div>

      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="hidden md:flex w-full px-8 py-8 items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-[1000]"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.1)]">
            <Shield className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-[0.2em] uppercase italic leading-none">Veridian</span>
            <span className="text-[8px] font-mono text-emerald-500/40 tracking-[0.4em] mt-1 uppercase leading-none">Intelligence System</span>
          </div>
        </div>
        <div className="px-5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em]">
          v.9.4
        </div>
      </motion.header>

      <main className="flex-1 flex items-center justify-center p-4 md:p-6 relative overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg relative"
        >
          <div className="bg-[#0A0A0A]/90 backdrop-blur-3xl border border-white/10 rounded-[28px] md:rounded-[48px] p-6 md:p-16 shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            
            <AnimatePresence mode="wait">
              {isLoading && !isSent ? (
                <motion.div 
                  key="loading-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-20 flex flex-col items-center gap-6"
                >
                  <div className="w-16 h-16 border-t-2 border-emerald-500 rounded-full animate-spin shadow-[0_0_20px_rgba(16,185,129,0.3)]" />
                  <span className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-[0.5em] animate-pulse italic">Iniciando sesión...</span>
                </motion.div>
              ) : !isSent ? (
                <motion.div 
                  key="login-form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4 md:space-y-10"
                >
                  <div className="space-y-1 md:space-y-3 text-center">
                    <motion.h2 
                      className="text-2xl md:text-4xl font-black uppercase tracking-tight italic leading-none text-white"
                    >
                      {authMode === 'login' ? 'ENTRAR' : 'REGISTRARSE'}
                    </motion.h2>
                    <div className="flex items-center justify-center gap-2">
                      <div className={`w-1 h-1 md:w-1.5 md:h-1.5 ${authMode === 'login' ? 'bg-emerald-500' : 'bg-cyan-500'} rounded-full animate-pulse`} />
                      <p className="text-[8px] md:text-[10px] font-mono uppercase tracking-[0.3em] md:tracking-[0.4em] text-white/30 italic">
                        {authMode === 'login' ? 'Identificación' : 'Reclutamiento'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 md:space-y-6">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleGoogleLogin}
                      className="w-full h-11 md:h-16 bg-white hover:bg-zinc-100 rounded-xl md:rounded-2xl flex items-center justify-center gap-3 transition-all"
                    >
                      <svg className="w-4 h-4 md:w-6 md:h-6" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      <span className="text-black font-black text-[10px] md:text-[12px] uppercase tracking-[0.2em]">
                        {authMode === 'login' ? 'Entrar con Google' : 'Registrarse con Google'}
                      </span>
                    </motion.button>

                    <div className="relative py-1 md:py-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/5"></div>
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-[#0A0A0A] px-4 text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] text-white/10 italic">O manualmente</span>
                      </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-8">
                      <div className="space-y-3 md:space-y-6">
                        <div className="space-y-1.5 md:space-y-3">
                          <label className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-white/20 ml-2">Email</label>
                          <div className="relative group">
                            <Mail className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/10 group-focus-within:text-emerald-500 transition-colors" />
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full h-11 md:h-16 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl pl-12 md:pl-14 pr-4 text-[13px] md:text-sm focus:outline-none focus:border-emerald-500/50 transition-all font-mono placeholder:text-white/5"
                              placeholder="tu@email.com"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5 md:space-y-3">
                          <div className="flex justify-between items-center px-2">
                            <label className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Contraseña</label>
                            <button 
                              type="button" 
                              onClick={handleForgotPassword}
                              className="text-[8px] md:text-[9px] font-black text-emerald-500/60 hover:text-emerald-400 uppercase tracking-widest transition-colors"
                            >
                              ¿Has olvidado la contraseña?
                            </button>
                          </div>
                          <div className="relative group">
                            <Lock className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/10 group-focus-within:text-emerald-500 transition-colors" />
                            <input
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full h-11 md:h-16 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl pl-12 md:pl-14 pr-12 md:pr-14 text-[13px] md:text-sm focus:outline-none focus:border-emerald-500/50 transition-all font-mono placeholder:text-white/5"
                              placeholder="••••••••"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 md:right-5 top-1/2 -translate-y-1/2 text-white/10 hover:text-white"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-[8px] text-white/20 uppercase tracking-widest ml-2 italic">Mínimo 8 caracteres, una mayúscula y un número o símbolo.</p>
                        </div>
                      </div>

                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button 
                          type="submit"
                          disabled={isLoading}
                          className={`w-full h-11 md:h-16 rounded-xl md:rounded-2xl text-[10px] md:text-[12px] font-black uppercase tracking-[0.4em] transition-all relative overflow-hidden ${authMode === 'login' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-cyan-500 hover:bg-cyan-400'} text-black shadow-[0_15px_30px_rgba(16,185,129,0.2)]`}
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2 md:gap-3">
                            {isLoading ? (authMode === 'login' ? 'Entrando...' : 'Registrando...') : (authMode === 'login' ? 'ENTRAR' : 'REGISTRARSE')} 
                            {!isLoading && <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />}
                          </span>
                        </Button>
                      </motion.div>

                      <div className="text-center pt-1">
                        <button
                          type="button"
                          onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                          className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-white transition-all border-b border-white/5 hover:border-emerald-500/50 pb-1"
                        >
                          {authMode === 'login' ? '¿NO TIENES CUENTA? REGÍSTRATE' : '¿YA TIENES CUENTA? ENTRA'}
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="sent-state"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-10 md:py-16 text-center space-y-6 md:space-y-8"
                >
                  <div className="relative mx-auto w-16 h-16 md:w-24 md:h-24">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 border-2 border-dashed border-emerald-500/30 rounded-full"
                    />
                    <div className="absolute inset-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                      <CheckCircle2 className="w-8 h-8 md:w-12 md:h-12 text-emerald-500" />
                    </div>
                  </div>
                  <div className="space-y-2 md:space-y-3">
                    <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight italic text-white leading-none">
                      {authMode === 'login' ? 'Protocolo Iniciado' : 'Registro Solicitado'}
                    </h3>
                    <p className="text-[9px] md:text-[11px] text-white/40 font-mono tracking-[0.2em] md:tracking-[0.3em] uppercase max-w-[280px] mx-auto leading-relaxed">
                      {authMode === 'login' 
                        ? 'Sincronización pendiente. Revisa tu email...' 
                        : 'Confirma tu email para activar tu cuenta Veridian.'}
                    </p>
                    {authMode === 'signup' && (
                      <div className="mt-4 px-4 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                        <p className="text-[8px] text-emerald-400 uppercase tracking-widest font-black">
                          Pulsa en el enlace del correo para completar el reclutamiento.
                        </p>
                      </div>
                    )}
                  </div>
                  <Button 
                    onClick={() => setIsSent(false)}
                    variant="ghost" 
                    className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500/60 hover:text-emerald-400"
                  >
                    Volver
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </main>

      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="w-full px-6 pb-6 pt-2 flex flex-col items-center gap-3 md:flex-row md:justify-between md:px-10 md:py-8 border-t border-white/5 bg-black/20"
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <div className="text-[7px] md:text-[10px] font-mono text-white/20 uppercase tracking-[0.3em] md:tracking-[0.4em] leading-none">
            Veridian Systems Operating Normal
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-8 text-[7px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-white/20">
          <a href="/privacidad" className="hover:text-emerald-500 transition-colors">Privacidad</a>
          <a href="/terminos" className="hover:text-emerald-500 transition-colors">Términos</a>
          <span className="text-white/5 font-mono leading-none">©2024</span>
        </div>
      </motion.footer>
    </div>
  );
};

export default VeridianLanding;
