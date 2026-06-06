import React, { useState } from 'react';
import { ZouttyIcon } from './ZouttyIcon';
import { CustomSelect } from './CustomSelect';
import { ChevronRight, Mic, HardDrive, Sparkles, Cloud } from 'lucide-react';
import { UI_LANGUAGE_NAMES } from '../i18n';
import { useTranslation } from '../i18n/TranslationContext';

export function WelcomeModal({
  onComplete,
  currentLanguage,
  setLanguage
}: {
  onComplete: () => void;
  currentLanguage: string;
  setLanguage: (lang: string) => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(['brazilian-zouk']);

  const danceStyles = [
    { id: 'brazilian-zouk', label: t('onboarding.brazilianZouk') },
    { id: 'bachata', label: t('onboarding.bachata') },
    { id: 'salsa', label: t('onboarding.salsa') },
    { id: 'west-coast-swing', label: t('onboarding.westCoastSwing') },
    { id: 'kizomba', label: t('onboarding.kizomba') },
    { id: 'other', label: t('onboarding.other') },
  ];

  const toggleStyle = (id: string) => {
    setSelectedStyles(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    setStep(1);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-500">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" />
      
      <div className="relative w-full max-w-md max-h-[90vh] bg-zinc-900/80 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-y-auto flex flex-col gap-8 animate-in slide-in-from-bottom-8 duration-700">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-brand/20 blur-[100px] pointer-events-none" />

        {step === 0 ? (
          <>
            <div className="flex flex-col items-center text-center gap-6 mt-4">
              <div className="relative">
                <div className="absolute inset-0 bg-brand/30 blur-2xl rounded-full animate-pulse-slow" />
                <ZouttyIcon className="w-20 h-20 text-brand relative z-10 animate-float" />
              </div>
              
              <div className="space-y-3">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {t('onboarding.welcomeTitle')}
                </h1>
                <p className="text-white/60 font-medium leading-relaxed max-w-[280px] mx-auto">
                  {t('onboarding.welcomeSubtitle')}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-white/50 px-1">
                  {t('onboarding.interfaceLanguage')}
                </label>
                <CustomSelect
                  value={currentLanguage}
                  onChange={setLanguage}
                  options={Object.entries(UI_LANGUAGE_NAMES).map(([val, label]) => ({ value: val, label }))}
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-white/50 px-1">
                  {t('onboarding.primaryStyles')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {danceStyles.map(style => (
                    <button
                      key={style.id}
                      onClick={() => toggleStyle(style.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border ${
                        selectedStyles.includes(style.id)
                          ? 'bg-brand/20 border-brand/50 text-brand'
                          : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/90'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleNext}
              className="w-full mt-4 bg-brand text-black font-bold text-base py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-brand/90 transition-colors active:scale-[0.98] shadow-lg shadow-brand/20"
            >
              {t('onboarding.continueBtn')}
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-6 mt-4">
              <div className="space-y-3 text-center">
                <h2 className="text-2xl font-black text-white tracking-tight">
                  {t('onboarding.beforeWeStart')}
                </h2>
                <p className="text-white/60 font-medium leading-relaxed max-w-[280px] mx-auto">
                  {t('onboarding.permissionsDesc')}
                </p>
              </div>

              <div className="space-y-4 mt-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex gap-4">
                  <div className="bg-brand/20 w-12 h-12 rounded-full flex items-center justify-center shrink-0">
                    <Mic className="w-6 h-6 text-brand" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold mb-1">{t('onboarding.micAccess')}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                      {t('onboarding.micDesc')}
                    </p>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex gap-4">
                  <div className="bg-blue-500/20 w-12 h-12 rounded-full flex items-center justify-center shrink-0">
                    <HardDrive className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold mb-1">{t('onboarding.localStorage')}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                      {t('onboarding.storageDesc')}
                    </p>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex gap-4">
                  <div className="bg-green-500/20 w-12 h-12 rounded-full flex items-center justify-center shrink-0">
                    <Cloud className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold mb-1">{t('onboarding.cloudBackup')}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                      {t('onboarding.cloudBackupDesc')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={onComplete}
              className="w-full mt-4 bg-brand text-black font-bold text-base py-4 rounded-2xl flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-[0.98] shadow-lg shadow-brand/20"
            >
              {t('onboarding.startExploring')}
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
