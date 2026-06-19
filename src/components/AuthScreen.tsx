import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, Loader2, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { ZouttyIcon } from './ZouttyIcon';
import { useTranslation } from '../i18n/TranslationContext';
import { UI_LANGUAGE_NAMES } from '../i18n';

interface AuthScreenProps {
  onSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const { t, uiLanguage, setUILanguage } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignupSuccess, setShowSignupSuccess] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        localStorage.setItem('zoutty_onboarding_completed', 'true');
        localStorage.setItem('zoutty_initial_sync_pending', 'true');
        window.location.reload(); // Force reload to completely clean state and trigger sync correctly
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        // With email confirmations disabled, Supabase logs them in immediately.
        // Show the success confirmation screen instead of jumping right in.
        setShowSignupSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      localStorage.setItem('zoutty_onboarding_completed', 'true');
      localStorage.setItem('zoutty_initial_sync_pending', 'true');
      const { error } = await supabase.auth.signInWithOAuth({ 
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (showSignupSuccess) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center p-6 z-[100] text-zinc-100 font-sans">
        <div className="w-full max-w-sm flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-20 h-20 bg-orange-500/20 text-orange-500 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-3">{t('auth.successTitle')}</h2>
          <p className="text-zinc-400 mb-8">
            {t('auth.successMsg')}
          </p>
          <button
            onClick={onSuccess}
            className="w-full bg-orange-500 hover:bg-orange-400 text-zinc-950 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {t('auth.getStartedBtn')}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center p-6 z-[100] text-zinc-100 font-sans relative">
      
      {/* Language Toggle */}
      <div className="absolute top-6 right-6 z-[210] flex gap-1 bg-white/5 border border-white/10 p-[3px] rounded-full">
        {Object.entries(UI_LANGUAGE_NAMES).map(([code]) => (
          <button
            key={code}
            onClick={() => setUILanguage(code as any)}
            className={`px-[14px] py-[6px] text-[12px] font-bold rounded-full tracking-[0.05em] transition-all duration-300 ${
              uiLanguage === code 
                ? 'bg-orange-500 text-zinc-950 shadow-[0_2px_8px_rgba(249,115,22,0.3)]' 
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            }`}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="w-full max-w-sm mt-8">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <ZouttyIcon className="w-20 h-20" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t('auth.title')}</h1>
          <p className="text-zinc-400 mt-2 text-center text-sm">
            {isLogin ? t('auth.loginSubtitle') : t('auth.signupSubtitle')}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">{t('auth.emailLabel')}</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                placeholder={t('auth.emailPlaceholder')}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">{t('auth.passwordLabel')}</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-11 pr-12 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                placeholder={t('auth.passwordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-400 text-zinc-950 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                {isLogin ? t('auth.signInBtn') : t('auth.createAccountBtn')}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 flex items-center gap-4">
          <div className="h-px bg-zinc-800 flex-1"></div>
          <span className="text-zinc-500 text-sm font-medium">{t('auth.or')}</span>
          <div className="h-px bg-zinc-800 flex-1"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full mt-8 bg-white hover:bg-zinc-200 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {t('auth.continueGoogle')}
        </button>

        <button
          onClick={() => {
            setIsLogin(!isLogin);
            setError(null);
          }}
          className="w-full mt-6 text-zinc-400 hover:text-white text-sm font-medium transition-colors"
        >
          {isLogin ? t('auth.toggleToSignup') : t('auth.toggleToLogin')}
        </button>

        <button
          type="button"
          onClick={() => {
            localStorage.setItem('zoutty_guest_mode', 'true');
            onSuccess();
          }}
          className="w-full mt-4 text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-colors uppercase tracking-wider"
        >
          {t('auth.continueGuest')}
        </button>
      </div>
    </div>
  );
};
