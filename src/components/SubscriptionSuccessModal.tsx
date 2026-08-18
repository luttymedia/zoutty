import React from 'react';
import {
  CheckCircle2,
  GraduationCap,
  Sparkle,
  Zap,
  AudioLines,
  Gift,
  ArrowRight,
} from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';
import { UserTier, TIER_LIMITS } from '../types';

interface SubscriptionSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: UserTier;
}

export const SubscriptionSuccessModal: React.FC<SubscriptionSuccessModalProps> = ({
  isOpen,
  onClose,
  tier,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  // A paid subscription is either 'teacher' or 'student'
  const isTeacher = tier === 'teacher';
  const effectiveTier: 'student' | 'teacher' = isTeacher ? 'teacher' : 'student';

  const planName = isTeacher
    ? t('billing.plans.teacherName')
    : t('billing.plans.studentName');

  const monthlySessions = isTeacher
    ? TIER_LIMITS.teacher.monthly_sessions
    : TIER_LIMITS.student.monthly_sessions;

  const monthlyClips = isTeacher
    ? t('billing.usage.infiniteUppercase')
    : TIER_LIMITS.student.monthly_clips;

  const themeColor = isTeacher
    ? {
        border: 'border-sky-400/80',
        bgGlow: 'bg-sky-500/20',
        badgeBg: 'bg-sky-500/30 text-sky-200 border-sky-400/40',
        iconBg: 'bg-sky-500/20 text-sky-400',
        btnBg: 'bg-sky-500 hover:bg-sky-400 shadow-sky-500/25',
        textColor: 'text-sky-300',
      }
    : {
        border: 'border-amber-400/80',
        bgGlow: 'bg-amber-500/20',
        badgeBg: 'bg-amber-500/30 text-amber-200 border-amber-400/40',
        iconBg: 'bg-amber-500/20 text-amber-400',
        btnBg: 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/25',
        textColor: 'text-amber-300',
      };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-[90] p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div
        className={`glass border ${themeColor.border} p-6 sm:p-8 max-w-md w-full rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-300 flex flex-col my-auto text-center`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glowing Ambient Halo */}
        <div
          className={`absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 ${themeColor.bgGlow} rounded-full blur-3xl pointer-events-none`}
        />

        {/* Celebration Header Icon */}
        <div className="relative mx-auto mb-4">
          <div
            className={`w-16 h-16 rounded-2xl ${themeColor.iconBg} border border-white/20 flex items-center justify-center shadow-lg mx-auto animate-bounce-short`}
          >
            {isTeacher ? (
              <Sparkle className="w-8 h-8 text-sky-300" />
            ) : (
              <GraduationCap className="w-8 h-8 text-amber-300" />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-zinc-900 flex items-center justify-center text-white">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1 mb-6">
          <span
            className={`inline-block text-[11px] px-3 py-0.5 rounded-full font-mono font-bold uppercase border ${themeColor.badgeBg} mb-1`}
          >
            {t('billing.plans.checkoutSuccessBadge')}
          </span>
          <h3 className="text-2xl font-black text-white tracking-tight">
            {t('billing.plans.checkoutSuccessModalTitle', { plan: planName })}
          </h3>
          <p className="text-xs sm:text-sm text-white/70 max-w-xs mx-auto">
            {t('billing.plans.checkoutSuccessModalSubtitle')}
          </p>
        </div>

        {/* Unlocked Benefits Card */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-3 mb-6">
          <div className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
            {t('billing.plans.unlockedPerksTitle')}
          </div>

          <div className="space-y-2.5 text-xs text-white/90">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <Zap className="w-3.5 h-3.5 text-brand" />
              </div>
              <span>
                <strong className={themeColor.textColor}>{monthlySessions}</strong> {t('billing.plans.monthlySessionsPerk')}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <AudioLines className="w-3.5 h-3.5 text-brand" />
              </div>
              <span>
                <strong className={themeColor.textColor}>{monthlyClips}</strong> {t('billing.plans.monthlyClipsPerk')}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                <Gift className="w-3.5 h-3.5 text-purple-300" />
              </div>
              <span className="text-white/80">
                {isTeacher
                  ? t('billing.limits.featureTeacherReferralDiscount')
                  : t('billing.limits.featureReferralDiscount')}
              </span>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onClose}
          className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm text-zinc-950 transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${themeColor.btnBg}`}
        >
          <span>{t('billing.plans.getStartedBtn')}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default SubscriptionSuccessModal;
