import React, { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';
import { apiState, ApiStatus } from '../lib/api';

export const ApiWakingToast: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ApiStatus>(apiState.getStatus());
  const [playfulMsgIndex, setPlayfulMsgIndex] = useState(0);

  useEffect(() => {
    return apiState.subscribe((newStatus) => {
      setStatus(newStatus);
    });
  }, []);

  // Cycle playful messages every 6 seconds while in 'waking' state
  useEffect(() => {
    if (status !== 'waking') return;

    const interval = setInterval(() => {
      setPlayfulMsgIndex((prev) => (prev + 1) % 3);
    }, 6000);

    return () => clearInterval(interval);
  }, [status]);

  if (status !== 'waking' && status !== 'unavailable') {
    return null;
  }

  const playfulMessages = [
    t('apiStatus.warmingUp'),
    t('apiStatus.wakingAi'),
    t('apiStatus.gettingReady'),
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] sm:w-auto transition-all duration-300">
      <div className="bg-stone-900/95 backdrop-blur-md text-white border border-stone-700 shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-3">
        {status === 'waking' ? (
          <>
            <div className="relative flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-teal-400 animate-spin" />
              <Sparkles className="w-2.5 h-2.5 text-teal-200 absolute -top-1 -right-1" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-stone-100 transition-opacity duration-300">
                {playfulMessages[playfulMsgIndex]}
              </span>
              <span className="text-xs text-stone-400">
                {t('apiStatus.wakingNotice')}
              </span>
            </div>
          </>
        ) : (
          <>
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="flex flex-col flex-1 mr-2">
              <span className="text-xs text-stone-300">
                {t('apiStatus.unavailable')}
              </span>
            </div>
            <button
              onClick={() => apiState.retry()}
              className="px-2.5 py-1 text-xs font-medium bg-teal-500 hover:bg-teal-400 text-stone-950 rounded-lg transition-colors shrink-0"
            >
              {t('apiStatus.retryBtn')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
