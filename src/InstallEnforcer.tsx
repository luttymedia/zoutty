import React, { useState, useEffect } from 'react';
import { useTranslation } from './i18n/TranslationContext';

export default function InstallEnforcer({ children }: { children: React.ReactNode }) {
  const { t, uiLanguage, setUILanguage } = useTranslation();
  const [isStandalone, setIsStandalone] = useState(true); // Default true to prevent flash
  const [installState, setInstallState] = useState<'idle' | 'ready' | 'prompting' | 'accepted' | 'dismissed' | 'installed'>('idle');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Platform detection
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isMobile = isIOS || isAndroid || /Mobi|Tablet|iPad|iPhone|Android/i.test(navigator.userAgent);
  const isIOSSafari = isIOS && /Safari/i.test(navigator.userAgent) && !/CriOS/i.test(navigator.userAgent) && !/FxiOS/i.test(navigator.userAgent) && !/OPiOS/i.test(navigator.userAgent) && !/EdgiOS/i.test(navigator.userAgent);
  const isIOSNonSafari = isIOS && !isIOSSafari;
  const isDesktop = !isMobile;

  useEffect(() => {
    // Check if running as standalone PWA
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    // Developer bypass
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isLocalIp = window.location.hostname === '192.168.1.135';
    
    if (checkStandalone || isLocalhost || isLocalIp) {
      console.log('InstallEnforcer: Bypassing install screen. checkStandalone:', checkStandalone, 'isLocalhost:', isLocalhost, 'isLocalIp:', isLocalIp);
      setIsStandalone(true);
      setInstallState('installed');
    } else {
      console.log('InstallEnforcer: Blocking access. Not standalone and no bypass matched.');
      setIsStandalone(false);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (installState === 'idle') setInstallState('ready');
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setInstallState('installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [installState]);

  if (isStandalone) {
    return <>{children}</>;
  }

  const triggerInstall = async () => {
    if (isIOSSafari) {
      setShowIosGuide(true);
      return;
    }
    if (deferredPrompt) {
      setInstallState('prompting');
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallState('accepted');
      } else {
        setInstallState('dismissed');
      }
      setDeferredPrompt(null);
    }
  };

  let btnText = t('installEnforcer.btnInstallText');
  let hintText = '';
  let btnClasses = "w-full max-w-xs mx-auto py-4 px-6 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all relative overflow-hidden ";
  let isDisabled = false;

  if (installState === 'installed') {
    btnText = t('installEnforcer.btnInstalled');
    btnClasses += "bg-white/10 text-white/50 cursor-not-allowed";
    isDisabled = true;
    hintText = t('installEnforcer.btnInstalledHint');
  } else if (isDesktop) {
    btnText = t('installEnforcer.btnInstallDesktop');
    btnClasses += "bg-white/10 text-white/50 cursor-not-allowed";
    isDisabled = true;
    hintText = t('installEnforcer.btnInstallDesktopHint');
  } else if (isIOSNonSafari) {
    btnText = t('installEnforcer.btnInstallSafari');
    btnClasses += "bg-white/10 text-white/50 cursor-not-allowed";
    isDisabled = true;
    hintText = t('installEnforcer.btnInstallSafariHint');
  } else if (isIOSSafari) {
    btnText = t('installEnforcer.btnInstallText');
    btnClasses += "bg-[#2DD4BF] text-black shadow-[0_0_20px_rgba(45,212,191,0.4)] active:scale-95";
    hintText = t('installEnforcer.btnInstallIOSHint');
  } else if (isAndroid) {
    if (installState === 'accepted') {
      btnText = t('installEnforcer.btnInstallInstalling');
      btnClasses += "bg-white/10 text-white/50 cursor-wait";
      hintText = t('installEnforcer.btnInstallInstallingHint');
    } else if (installState === 'dismissed') {
      btnText = t('installEnforcer.btnInstallText');
      btnClasses += "bg-white/10 text-white/50 cursor-not-allowed";
      isDisabled = true;
      hintText = t('installEnforcer.btnInstallDismissedHint');
    } else if (installState === 'ready') {
      btnText = t('installEnforcer.btnInstallText');
      btnClasses += "bg-[#2DD4BF] text-black shadow-[0_0_20px_rgba(45,212,191,0.4)] active:scale-95";
    } else {
      btnText = t('installEnforcer.btnInstallText');
      btnClasses += "bg-white/10 text-white/50 cursor-wait";
      hintText = t('installEnforcer.btnInstallPreparingHint');
    }
  } else {
    btnClasses += "bg-[#2DD4BF] text-black shadow-[0_0_20px_rgba(45,212,191,0.4)] active:scale-95";
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Background styling elements */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#2DD4BF]/50 rounded-full mix-blend-screen filter blur-[120px] animate-pulse-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#c084fc]/50 rounded-full mix-blend-screen filter blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-10 pointer-events-none"></div>

      {/* Language Switcher Pill */}
      <div className="absolute top-6 right-6 flex gap-1 bg-white/5 border border-white/10 p-1 rounded-full z-20">
        <button 
          className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${uiLanguage === 'en' ? 'bg-[#2DD4BF] text-black shadow-[0_2px_8px_rgba(45,212,191,0.3)]' : 'text-white/50 hover:text-white/80'}`}
          onClick={() => setUILanguage('en')}
        >
          EN
        </button>
        <button 
          className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${uiLanguage === 'es' ? 'bg-[#2DD4BF] text-black shadow-[0_2px_8px_rgba(45,212,191,0.3)]' : 'text-white/50 hover:text-white/80'}`}
          onClick={() => setUILanguage('es')}
        >
          ES
        </button>
      </div>

      <div className="z-10 text-center max-w-sm">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 191.39 191.39"
          className="w-20 h-20 relative z-10 shrink-0 mx-auto animate-float"
        >
          <g id="LOGO">
            <rect id="BOX" fill="#2dd4bf" width="191.39" height="191.39" rx="41.01" ry="41.01"/>
            <g id="Z">
              <path fill="#fff" d="M123.89,48.12h.2c.07,0,.13.02.19.02.16,0,.32.02.48.05.14.02.28.04.42.08.15.04.29.08.43.13.14.05.28.1.42.17.13.06.25.13.37.2.14.08.28.17.41.27.05.04.11.06.16.1.06.05.1.11.16.16.12.11.23.22.34.34.1.11.19.22.27.33.09.12.17.24.25.37.08.13.15.25.21.38.06.13.12.27.17.41.05.14.09.28.13.42.04.14.06.28.09.43.02.16.04.32.05.48,0,.08.02.15.02.22,0,.07-.02.13-.02.19,0,.16-.02.32-.05.48-.02.14-.04.28-.08.42-.04.15-.08.29-.13.43-.05.14-.1.28-.17.42-.06.13-.13.25-.2.37-.08.14-.17.28-.27.41-.04.05-.06.11-.11.16l-50.94,62.71h18.7l44.34-54.09c10.25-12.5,1.35-31.29-14.81-31.29h0s-.04,0-.06,0c-.01,0-.02,0-.03,0H54.8c-4.15,0-7.52,3.37-7.52,7.52v.17c0,4.15,3.37,7.52,7.52,7.52h69.09Z"/>
              <path fill="#fff" d="M67.34,127.43h-.25c-.07,0-.13-.02-.19-.02-.16,0-.32-.02-.48-.05-.14-.02-.28-.04-.42-.08-.14-.04-.29-.08-.43-.13-.14-.05-.29-.1-.42-.17-.13-.06-.25-.13-.37-.2-.14-.08-.28-.17-.41-.27-.05-.04-.11-.06-.16-.1-.06-.05-.1-.11-.16-.16-.12-.11-.24-.22-.34-.34-.1-.11-.19-.22-.27-.33-.09-.12-.17-.25-.25-.37-.08-.13-.15-.25-.21-.38-.06-.13-.12-.27-.17-.41-.05-.14-.09-.28-.13-.42-.04-.14-.06-.28-.09-.43-.02-.16-.04-.32-.05-.48,0-.08-.02-.15-.02-.22,0-.07.02-.13.02-.19,0-.16.02-.32.05-.48.02-.14.04-.28.08-.42.04-.15.08-.29.13-.43.05-.14.1-.28.17-.42.06-.13.13-.25.2-.37-.08-.14.17-.28.27-.41.04-.05.06-.11.11-.16l50.94-62.71h-18.6l-44.23,53.96c-10.25,12.5-1.35,31.29,14.81,31.29h0c.05,0,.11,0,.16,0,.03,0,.06,0,.09,0h60.18s-3.12,3.12-3.12,3.12c-2.94,2.94-2.94,7.7,0,10.64s7.7,2.94,10.64,0l15.95-15.95c1.47-1.47,2.21-3.41,2.2-5.34,0-1.93-.73-3.86-2.2-5.34l-15.95-15.95c-2.94-2.94-7.7-2.94-10.64,0s-2.94,7.7,0,10.64l3.12,3.12-59.56-.04Z"/>
            </g>
          </g>
        </svg>
        <div className="flex flex-col justify-center relative z-10 mb-8 mt-2 text-center">
          <h1 className="text-3xl tracking-[0.2em] text-[#2DD4BF] font-black leading-none">ZOUTTY</h1>
        </div>
        
        <h2 className="text-3xl font-black tracking-tight mb-4">{t('installEnforcer.title')}</h2>
        <p className="text-white/60 text-base leading-relaxed mb-6" dangerouslySetInnerHTML={{ __html: t('installEnforcer.subtitle') }}></p>

        <button 
          className={btnClasses} 
          onClick={triggerInstall}
          disabled={isDisabled}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
          <span>{btnText}</span>
        </button>

        <p className="mt-4 text-xs text-white/40 leading-relaxed max-w-[280px] mx-auto">
          {t('installEnforcer.alreadyInstalled')}
        </p>
        
        {hintText && (
          <p className="mt-4 text-xs text-white/40 leading-relaxed max-w-[250px] mx-auto" dangerouslySetInnerHTML={{ __html: hintText }}></p>
        )}
      </div>

      {showIosGuide && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end justify-center pb-8 px-4" onClick={() => setShowIosGuide(false)}>
          <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-md p-6 relative animate-in slide-in-from-bottom-8 duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <span className="font-bold text-lg">{t('installEnforcer.iosTitle')}</span>
              <button onClick={() => setShowIosGuide(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">✕</button>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 rounded-full bg-[#2DD4BF]/20 text-[#2DD4BF] flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">1</div>
                <div className="text-white/80 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: t('installEnforcer.iosStep1') }}></div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 rounded-full bg-[#2DD4BF]/20 text-[#2DD4BF] flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">2</div>
                <div className="text-white/80 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: t('installEnforcer.iosStep2') }}></div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 rounded-full bg-[#2DD4BF]/20 text-[#2DD4BF] flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">3</div>
                <div className="text-white/80 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: t('installEnforcer.iosStep3') }}></div>
              </div>
            </div>
            
            <button className="w-full bg-white/10 hover:bg-white/15 text-white py-3.5 rounded-xl font-bold transition-colors" onClick={() => setShowIosGuide(false)}>
              {t('installEnforcer.iosGotIt')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
