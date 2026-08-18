import React, { useState } from 'react';
import { Gift, Copy, Check, X, Share2, Sparkles, Zap, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';
import { UserTier, TIER_LIMITS } from '../types';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: UserTier;
  referralCode: string;
  boostActive?: boolean;
  boostExpiresAt?: string | null;
  creditsBalance?: number;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({
  isOpen,
  onClose,
  tier,
  referralCode,
  boostActive = false,
  boostExpiresAt,
  creditsBalance = 0,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://zoutty.app';
  const referralLink = `${origin}?ref=${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: 'Zoutty - Dance Notes & AI Assistant',
          text: `${t('billing.referrals.shareText')} ${referralLink}`,
          url: referralLink,
        })
        .catch(() => {});
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-[80] p-4 sm:p-6 overflow-y-auto">
      <div
        className="glass border border-purple-500/40 p-6 sm:p-8 max-w-md w-full rounded-3xl shadow-2xl relative animate-in zoom-in-95 flex flex-col text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto shadow-lg mb-4">
          <Gift className="w-8 h-8" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white tracking-tight mb-1">
          {t('billing.referrals.title')}
        </h3>
        <p className="text-xs text-white/60 mb-6">
          {t('billing.referrals.subtitle')}
        </p>

        {/* Active Boost Banner if applicable */}
        {boostActive && boostExpiresAt && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-5 flex items-center gap-2.5 text-left">
            <Sparkles className="w-5 h-5 shrink-0" />
            <div>
              <div className="font-bold">{t('billing.referrals.freeBoostTitle')}</div>
              <div className="text-[11px] text-emerald-400/80">
                {t('billing.referrals.freeBoostDesc', {
                  sessions: TIER_LIMITS.referral_boost.extra_sessions,
                  clips: TIER_LIMITS.referral_boost.extra_clips,
                  days: Math.max(
                    1,
                    Math.ceil(
                      (new Date(boostExpiresAt).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24)
                    )
                  ),
                })}
              </div>
            </div>
          </div>
        )}

        {/* Reward Explanation for User Tier */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-2 mb-6 text-xs text-white/80">
          <div className="text-[10px] uppercase font-bold text-white/40 tracking-wider">
            {t('billing.referrals.howRewardsWork')}
          </div>
          {tier === 'free' ? (
            <p className="leading-relaxed">
              {t('billing.referrals.rewardDescFree')}
            </p>
          ) : tier === 'student' ? (
            <p className="leading-relaxed">
              {t('billing.referrals.rewardDescStudent')}
            </p>
          ) : (
            <p className="leading-relaxed">
              {t('billing.referrals.rewardDescTeacher')}
            </p>
          )}
        </div>

        {/* Referral Link & Code Box */}
        <div className="space-y-3 mb-6">
          <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 block text-left">
            {t('billing.referrals.yourCode')}
          </label>
          <div className="flex items-center gap-2 p-2 pl-4 rounded-2xl bg-zinc-900 border border-white/15">
            <span className="font-mono text-base font-bold text-brand tracking-widest flex-1 text-left select-all">
              {referralCode || 'ZOU-XXXX'}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 rounded-xl bg-brand/10 hover:bg-brand/20 text-brand text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">{t('billing.referrals.linkCopied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>{t('billing.referrals.copyLink')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Share Button */}
        <button
          type="button"
          onClick={handleShare}
          className="w-full py-3.5 px-4 rounded-xl bg-brand hover:bg-brand/90 text-zinc-950 text-sm font-bold shadow-lg shadow-brand/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
          <span>{t('billing.referrals.shareAction')}</span>
        </button>
      </div>
    </div>
  );
};

export default ReferralModal;
