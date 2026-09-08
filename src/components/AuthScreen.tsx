import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, Loader2, ArrowRight, Eye, EyeOff, CheckCircle2, Gift, CloudOff, AlertTriangle, User } from 'lucide-react';
import { ZouttyIcon } from './ZouttyIcon';
import { useTranslation } from '../i18n/TranslationContext';
import { UI_LANGUAGE_NAMES } from '../i18n';

interface AuthScreenProps {
  onSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const { t, uiLanguage, setUILanguage } = useTranslation();
  const referralSignupCode = typeof window !== 'undefined' ? localStorage.getItem('zoutty_referral_signup_code') : null;
  // If user landed with a referral code, open directly in "Create Account" mode
  const [isLogin, setIsLogin] = useState(!referralSignupCode);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignupSuccess, setShowSignupSuccess] = useState(false);
  const [showGuestConfirm, setShowGuestConfirm] = useState(false);
  const [inviteCode, setInviteCode] = useState(referralSignupCode || '');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!isLogin && !displayName.trim()) {
      setError(t('auth.displayNameRequired'));
      setLoading(false);
      return;
    }

    if (!email.trim()) {
      setError(t('auth.emailRequired'));
      setLoading(false);
      return;
    }

    if (!password) {
      setError(t('auth.passwordRequired'));
      setLoading(false);
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      setLoading(false);
      return;
    }

    try {
      if (!isLogin && inviteCode.trim()) {
        localStorage.setItem('zoutty_referral_signup_code', inviteCode.trim());
      }
      
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        localStorage.setItem('zoutty_initial_sync_pending', 'true');
        window.location.reload(); // Force reload to completely clean state and trigger sync correctly
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              display_name: displayName.trim()
            }
          }
        });
        if (error) throw error;
        
        // With email confirmations disabled, Supabase logs them in immediately.
        // Show the success confirmation screen instead of jumping right in.
        setShowSignupSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || t('auth.authFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      if (!isLogin && inviteCode.trim()) {
        localStorage.setItem('zoutty_referral_signup_code', inviteCode.trim());
      }
      localStorage.setItem('zoutty_initial_sync_pending', 'true');
      const { error } = await supabase.auth.signInWithOAuth({ 
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline',
          }
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || t('auth.authFailed'));
    }
  };

  if (showSignupSuccess) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center p-6 z-[100] text-zinc-100 font-sans">
        <div className="w-full max-w-sm flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-20 h-20 bg-brand/20 text-brand rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl tracking-tight mb-3">{t('auth.successTitle')}</h2>
          <p className="text-zinc-400 mb-8">
            {t('auth.successMsg')}
          </p>
          <button
            onClick={onSuccess}
            className="w-full bg-brand hover:bg-brand/90 text-bg-dark py-4 rounded-xl transition-all flex items-center justify-center gap-2"
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
            className={`px-[14px] py-[6px] text-[12px] rounded-full tracking-[0.05em] transition-all duration-300 ${
              uiLanguage === code 
                ? 'bg-brand text-bg-dark shadow-[0_2px_8px_rgba(45,212,191,0.3)]' 
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
          <h1 className="text-3xl font-bold font-logo tracking-tight">{t('auth.title')}</h1>
          <p className="text-zinc-400 mt-2 text-center text-sm">
            {isLogin ? t('auth.loginSubtitle') : t('auth.signupSubtitle')}
          </p>
        </div>

        {referralSignupCode && (
          <div className="mb-5 px-3.5 py-2.5 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs flex items-center gap-3 shadow-lg shadow-purple-950/30 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
              <Gift className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <span className="text-white block truncate">
                {t('billing.referrals.invitedByFriendBadge', { code: referralSignupCode })}
              </span>
              <span className="text-[11px] text-purple-300/80 block mt-0.5">
                {isLogin ? t('billing.referrals.invitedSignInNote') : t('billing.referrals.invitedSignUpNote')}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleAuth} noValidate className="space-y-4">
          {!isLogin && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
              <label className="text-xs text-zinc-400 uppercase tracking-wider ml-1">{t('auth.displayNameLabel', { fallback: 'Display Name' })}</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all"
                  placeholder={t('auth.displayNamePlaceholder', { fallback: 'e.g. DanceLover99' })}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 uppercase tracking-wider ml-1">{t('auth.emailLabel')}</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all"
                placeholder={t('auth.emailPlaceholder')}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 uppercase tracking-wider ml-1">{t('auth.passwordLabel')}</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-11 pr-12 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all"
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

          {!isLogin && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
              <label className="text-xs text-zinc-400 uppercase tracking-wider ml-1">{t('auth.confirmPasswordLabel')}</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-11 pr-12 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all"
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

          {!isLogin && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
              <label className="text-xs text-zinc-400 uppercase tracking-wider ml-1">{t('auth.inviteCodeLabel', { fallback: 'Have an invite code?' })}</label>
              <div className="relative">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all font-mono"
                  placeholder={t('auth.inviteCodePlaceholder', { fallback: 'e.g. DANCE1 (Optional)' })}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs text-center animate-in fade-in slide-in-from-top-1 duration-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand/90 text-bg-dark py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70 cursor-pointer"
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
          <span className="text-zinc-500 text-sm">{t('auth.or')}</span>
          <div className="h-px bg-zinc-800 flex-1"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full mt-8 bg-white hover:bg-zinc-200 text-black py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 cursor-pointer"
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
            setPassword('');
            setConfirmPassword('');
          }}
          className="w-full mt-6 text-zinc-400 hover:text-white text-sm transition-colors cursor-pointer"
        >
          {isLogin ? t('auth.toggleToSignup') : t('auth.toggleToLogin')}
        </button>

        <button
          type="button"
          onClick={() => setShowGuestConfirm(true)}
          className="w-full mt-4 text-zinc-500 hover:text-zinc-300 text-xs transition-colors uppercase tracking-wider"
        >
          {t('auth.continueGuest')}
        </button>
      </div>

      {showGuestConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-[110] animate-in fade-in duration-200">
          <div className="bg-[#111111] border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mb-4 border border-amber-500/20">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-xl mb-3">{t('auth.guestConfirmTitle')}</h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-4">
              {t('auth.guestConfirmMsg')}
            </p>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 space-y-3">
              <div className="flex items-start gap-3">
                <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="text-sm text-white/80 leading-snug">{t('auth.guestConfirmList1')}</span>
              </div>
              <div className="flex items-start gap-3">
                <CloudOff className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                <span className="text-sm text-white/80 leading-snug">{t('auth.guestConfirmList2')}</span>
              </div>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="text-sm text-white/80 leading-snug">{t('auth.guestConfirmList3')}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowGuestConfirm(false)}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white text-sm"
              >
                {t('auth.guestConfirmCancel')}
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('zoutty_guest_mode', 'true');
                  onSuccess();
                }}
                className="px-5 py-3 rounded-xl bg-brand hover:bg-brand/90 transition-colors text-bg-dark text-sm shadow-lg shadow-brand/20"
              >
                {t('auth.guestConfirmProceed')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
