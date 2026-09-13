import React, { useEffect, useState } from 'react';
import { LoaderIcon } from './LoaderIcon';
import { useTranslation } from '../i18n/TranslationContext';
import { apiState } from '../lib/api';

export const ApiWakingModal: React.FC = () => {
  const { t } = useTranslation();
  const [isAwaiting, setIsAwaiting] = useState(apiState.isAwaiting());
  const [playfulMsgIndex, setPlayfulMsgIndex] = useState(0);

  useEffect(() => {
    return apiState.subscribeAwaiting((awaiting) => {
      setIsAwaiting(awaiting);
    });
  }, []);

  // Cycle playful messages every 5 seconds while active
  useEffect(() => {
    if (!isAwaiting) return;

    const interval = setInterval(() => {
      setPlayfulMsgIndex((prev) => (prev + 1) % 3);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAwaiting]);

  if (!isAwaiting) {
    return null;
  }

  const playfulMessages = [
    t('apiStatus.warmingUp'),
    t('apiStatus.wakingAi'),
    t('apiStatus.gettingReady'),
  ];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center z-[70] text-white font-sans animate-in fade-in duration-300 px-6">
      <div className="flex flex-col items-center gap-6 max-w-sm text-center">
        <LoaderIcon className="w-[72px] h-auto overflow-visible" />
        <div className="flex flex-col items-center gap-2">
          <span className="text-xl font-semibold tracking-wide text-teal-300 transition-all duration-300">
            {playfulMessages[playfulMsgIndex]}
          </span>
          <span className="text-sm text-stone-300/80 leading-relaxed max-w-xs">
            {t('apiStatus.wakingNotice')}
          </span>
        </div>
      </div>
    </div>
  );
};
