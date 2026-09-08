import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Plus,
  Mic,
  Square,
  Upload,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileAudio,
  Video,
  Wand2,
  Trash2,
  Calendar,
  Clock,
  CheckCircle2,
  Sparkles,
  Edit2,
  Globe,
  Download,
  Zap,
  GripHorizontal,
  GripVertical,
  X,
  Folder,
  FolderPlus,
  FolderOpen,
  Library,
  Share2,
  Copy,
  SlidersHorizontal,
  Settings,
  BookOpen,
  Music,
  Images,
  AlertTriangle,
  LinkIcon,
  AudioLines,
  Play,
  CloudUpload,
  CloudDownload,
  Search,
  LogOut,
  ArrowRight,
  Database,
  FlaskConical,
  Bot,
  Gift,
  ShieldCheck,
  Lock,
  Cloud,
  CreditCard,
  Compass,
  Check,
  Tag,
  Eye,
  EyeOff,
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { format } from 'date-fns';
import { db, readFromCloud, isDemoItem } from './lib/db';
import { callZoukAudioProcessor } from './lib/mcp';
import { Session, AudioEntry, Language, StrictSummary, ExpandedInsights, SessionGroup, DanceGlossary, SessionMedia, TIER_LIMITS, UserTier } from './types';
import { SYSTEM_GLOSSARIES } from './lib/systemGlossaries';
import { DevState, getDevState, saveDevState, syncWithCloudProfile, resetDevState } from './lib/devLab';
import { TestLabModal } from './components/TestLabModal';
import { QuotaExceededModal } from './components/QuotaExceededModal';
import { AudioDurationExceededModal, ExceededAudioFile } from './components/AudioDurationExceededModal';
import { RecordingAutoStoppedModal } from './components/RecordingAutoStoppedModal';
import { PricingModal } from './components/PricingModal';
import { GlossaryModal } from './components/GlossaryModal';
import { MandatoryGlossaryModal } from './components/MandatoryGlossaryModal';
import { ReferralModal } from './components/ReferralModal';
import { SubscriptionSuccessModal } from './components/SubscriptionSuccessModal';
import { TopupSuccessModal } from './components/TopupSuccessModal';
import { TopupConfirmModal } from './components/TopupConfirmModal';
import { ManageSubscriptionModal, ModalView as ManageSubscriptionView } from './components/ManageSubscriptionModal';
import { getMediaDuration } from './lib/audioDuration';
import { isVideoFile, extractAudioFromVideo, ExtractedAudioResult } from './lib/audioExtractor';
import { formatSafeDate } from './lib/dateUtils';
import { openStripeCustomerPortal, startStripeCheckout, startTopupCheckout, updateStripeSubscription, cancelStripeSubscription, reactivateStripeSubscription, cancelStripeDowngrade } from './lib/stripe';

import { ZouttyIcon } from './components/ZouttyIcon';
import { LoaderIcon } from './components/LoaderIcon';
import { LogoAnimation } from './components/LogoAnimation';
import { CustomSelect } from './components/CustomSelect';
import { GlossaryCombobox } from './components/GlossaryCombobox';
import { MultiSelectCombobox } from './components/MultiSelectCombobox';
import { CustomCheckbox } from './components/CustomCheckbox';
import { CustomSwitch } from './components/CustomSwitch';
import { AutoGrowingTextarea } from './components/AutoGrowingTextarea';
import { WelcomeModal } from './components/WelcomeModal';
import { NewSessionEntryModal, EntryOption } from './components/NewSessionEntryModal';
import { RecordingCountdownOverlay } from './components/RecordingCountdownOverlay';
import { HistoryView } from './components/HistoryView';
import { TopicsView } from './components/TopicsView';
import { InteractiveOnboardingOverlay, OnboardingStepConfig } from './components/InteractiveOnboardingOverlay';
import { SearchModal } from './components/SearchModal';
import { SearchFilters, performSearch, normalizeSearchText } from './lib/search';
import Markdown from 'react-markdown';
import { useTranslation } from './i18n/TranslationContext';
import { UI_LANGUAGE_NAMES } from './i18n';
import { supabase } from './lib/supabase';
import { syncEngine } from './lib/syncEngine';
import { AuthScreen } from './components/AuthScreen';
import { dbStart } from './lib/db';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { version } from './version';
import { changelog } from './changelog';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const blobToBase64 = (blob?: Blob): Promise<string> => {
  return new Promise((resolve) => {
    if (!blob || !(blob instanceof Blob)) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        const b64 = (reader.result as string).split(',')[1] || '';
        resolve(b64);
      } else {
        resolve('');
      }
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
};

// --- Toast & Spinner Components ---
function Toast({
  message,
  isError,
  variant,
  actionText,
  onAction,
  onClose,
  duration = 5000,
}: {
  message: string;
  isError?: boolean;
  variant?: 'success' | 'error' | 'warning' | 'info';
  actionText?: string;
  onAction?: () => void;
  onClose: () => void;
  duration?: number;
}) {
  const [offset, setOffset] = useState(0);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStart.current;
    setOffset(diff);
  };

  const handleTouchEnd = () => {
    if (Math.abs(offset) > 100) {
      onClose();
    } else {
      setOffset(0);
    }
    touchStart.current = null;
  };

  const isDragging = touchStart.current !== null;

  const bgStyle =
    variant === 'warning'
      ? 'bg-amber-600 border border-amber-400 text-amber-50 shadow-amber-900/40'
      : isError || variant === 'error'
      ? 'bg-red-600'
      : 'bg-green-600';

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(calc(-50% + ${offset}px))`,
        opacity: 1 - Math.abs(offset) / 200,
        transition: isDragging ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out',
      }}
      className={`fixed bottom-6 left-1/2 w-[90%] md:w-auto max-w-md md:max-w-lg px-5 py-3.5 rounded-2xl text-white text-sm z-[60] shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-5 ${bgStyle}`}
    >
      <span className="flex-1">{message}</span>
      {actionText && onAction && (
        <button
          onClick={() => {
            onAction();
            onClose();
          }}
          className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs uppercase tracking-wider transition-colors shrink-0"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}

function Spinner({ text, onCancel }: { text: string; onCancel?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[60] text-white font-sans animate-in fade-in duration-200">
      <div className="flex flex-col items-center gap-6">
        <LoaderIcon className="w-[60px] h-auto overflow-visible" />
        <span className="loader-text">{text}</span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-2 px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/20 text-sm text-white/90 transition-all duration-200 shadow-sm flex items-center gap-2 backdrop-blur-md cursor-pointer"
          >
            <X className="w-4 h-4 text-white/70" />
            <span>{t('common.cancel')}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function AppSettingsCollapsible({
  label,
  icon,
  children,
  defaultOpen = false,
  badge
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-2.5 text-left group cursor-pointer transition-colors"
      >
        <span className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/50 group-hover:text-white/80 transition-colors">
          {icon}
          <span>{label}</span>
        </span>
        <div className="flex items-center gap-2">
          {badge}
          <ChevronDown className={`w-4 h-4 text-white/30 group-hover:text-white/60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="pt-1.5 pb-2 animate-in fade-in duration-150">
          {children}
        </div>
      )}
    </div>
  );
}

const getSessionDefaultTitle = (date: Date | number, lang: string) => {
  const d = new Date(date);
  if (lang === 'es') {
    const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const dayName = days[d.getDay()];
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${dayName} ${day}/${month}/${year}`;
  } else {
    return format(d, "EEE dd/MM/yy");
  }
};

const migrateOldData = async () => {
  try {
    const idb = await dbStart();
    const tables = ['sessions', 'audios', 'finalReports', 'sessionGroups', 'glossaries', 'sessionMedia'];
    for (const table of tables) {
      const tx = idb.transaction(table, 'readwrite');
      const store = tx.objectStore(table);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result as any[];
        for (const item of items) {
          if (isDemoItem(item)) {
            if (item.deleted) {
              store.delete(item.id);
            } else if (item.pending_sync) {
              item.pending_sync = false;
              store.put(item);
            }
          } else if (item.pending_sync === undefined) {
            item.pending_sync = true;
            store.put(item);
          }
        }
      };
    }
    localStorage.setItem('zoutty_migrated_to_supabase', 'true');
  } catch (e) {
    console.error('Migration failed:', e);
  }
};

export default function App() {
  const { t, uiLanguage, setUILanguage } = useTranslation();
  const [session, setSession] = useState<any>(null);
  const [isInitializingAuth, setIsInitializingAuth] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(
    () => localStorage.getItem('zoutty_onboarding_completed') === 'true'
  );
  const [onboardingTourStep, setOnboardingTourStep] = useState<number | null>(() => {
    const isCompleted = localStorage.getItem('zoutty_onboarding_completed') === 'true';
    const isGuest = localStorage.getItem('zoutty_guest_mode') === 'true';
    return (!isCompleted && isGuest) ? 0 : null;
  });
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [homeTab, setHomeTab] = useState<'history' | 'library' | 'topics'>(() => {
    return (localStorage.getItem('zoutty_home_tab') as 'history' | 'library' | 'topics') || 'history';
  });
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [pendingSessionAction, setPendingSessionAction] = useState<'record' | 'upload_audio' | 'upload_video' | null>(null);

  const handleTabChange = (tab: 'history' | 'library' | 'topics') => {
    setHomeTab(tab);
    localStorage.setItem('zoutty_home_tab', tab);
  };

  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [audioEntries, setAudioEntries] = useState<Record<string, AudioEntry>>({});
  const [sessionMedia, setSessionMedia] = useState<SessionMedia[]>([]);

  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean; variant?: 'success' | 'error' | 'warning' | 'info'; actionText?: string; onAction?: () => void; duration?: number } | null>(null);
  const [spinnerConfig, setSpinnerConfig] = useState<{ text: string; onCancel?: () => void } | null>(null);
  const [logoAnimationType, setLogoAnimationType] = useState<'onboarding' | 'restore' | null>(null);

  const [deleteModal, setDeleteModal] = useState<{ id: string, type: 'session' | 'audio', title: string } | null>(null);
  const [reprocessModal, setReprocessModal] = useState<string | null>(null);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showTestLabModal, setShowTestLabModal] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState<{ isOpen: boolean; reason: 'sessions' | 'clips' }>({ isOpen: false, reason: 'sessions' });
  const [showDurationExceededModal, setShowDurationExceededModal] = useState<{ isOpen: boolean; files: ExceededAudioFile[] }>({ isOpen: false, files: [] });
  const [showAutoStoppedModal, setShowAutoStoppedModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showSubscriptionSuccessModal, setShowSubscriptionSuccessModal] = useState<{ isOpen: boolean; tier: UserTier }>({ isOpen: false, tier: 'student' });
  const [showTopupSuccessModal, setShowTopupSuccessModal] = useState(false);
  const [showTopupConfirmModal, setShowTopupConfirmModal] = useState(false);
  const [isTopupLoading, setIsTopupLoading] = useState(false);
  const [showManageSubscriptionModal, setShowManageSubscriptionModal] = useState(false);
  const [manageSubscriptionInitialView, setManageSubscriptionInitialView] = useState<ManageSubscriptionView>('overview');
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [isCancelingDowngrade, setIsCancelingDowngrade] = useState(false);
  const [paymentBannerDismissed, setPaymentBannerDismissed] = useState(false);
  const [showGlossaryModal, setShowGlossaryModal] = useState(false);
  const [editingGlossary, setEditingGlossary] = useState<DanceGlossary | null>(null);
  const [userReferralCode, setUserReferralCode] = useState(() => localStorage.getItem('zoutty_referral_code') || 'ZOU-DANCE');
  const [referralStats, setReferralStats] = useState<{
    totalReferrals: number;
    pendingRefundCount: number;
    creditsBalance: number;
    boostActive: boolean;
    boostExpiresAt: string | null;
    boostExtraSessions: number;
    boostExtraClips: number;
  }>({
    totalReferrals: 0,
    pendingRefundCount: 0,
    creditsBalance: 0,
    boostActive: false,
    boostExpiresAt: null,
    boostExtraSessions: 0,
    boostExtraClips: 0,
  });
  const [devState, setDevState] = useState<DevState>(() => getDevState());
  const [showAppSettings, setShowAppSettings] = useState(false);
  const [showGuestLockModal, setShowGuestLockModal] = useState(false);

  // Account Management States
  const [editDisplayName, setEditDisplayName] = useState('');
  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [hasPasswordSet, setHasPasswordSet] = useState<boolean | null>(null);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountConfirmInput, setDeleteAccountConfirmInput] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const checkUserHasPassword = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('user_has_password');
      if (!error && typeof data === 'boolean') {
        setHasPasswordSet(data);
      }
    } catch {
      // RPC might not exist or network offline
    }
  }, []);

  const fetchReferralStats = useCallback(async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      if (!token) return;

      const res = await fetch('/api/referrals/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const stats = await res.json();
        setReferralStats({
          totalReferrals: stats.totalReferrals || 0,
          pendingRefundCount: stats.pendingRefundCount || 0,
          creditsBalance: stats.creditsBalance || 0,
          boostActive: stats.boostActive || false,
          boostExpiresAt: stats.boostExpiresAt || null,
          boostExtraSessions: stats.boostExtraSessions || 0,
          boostExtraClips: stats.boostExtraClips || 0,
        });
        if (stats.referralCode) {
          setUserReferralCode(stats.referralCode);
          localStorage.setItem('zoutty_referral_code', stats.referralCode);
        }
      }
    } catch (err) {
      console.warn('[Referral] Could not fetch referral stats:', err);
    }
  }, []);

  const fetchCloudProfileAndUsage = useCallback(async (token?: string) => {
    try {
      if (!token) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token;
      }
      if (!token) return;

      const { data: userData } = await supabase.auth.getUser(token);
      const userId = userData?.user?.id;
      if (!userId) return;

      const [{ data: profile }, { data: usage }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('usage_tracking').select('*').eq('user_id', userId).maybeSingle()
      ]);

      const hasGlossaries = profile?.active_glossaries && Array.isArray(profile.active_glossaries) && profile.active_glossaries.length > 0;
      const hasUsage = usage && (usage.lifetime_sessions > 0 || usage.lifetime_clips > 0);

      if (hasGlossaries) {
        setActiveGlossaryIds(profile.active_glossaries);
        localStorage.setItem('zoutty_active_glossaries', JSON.stringify(profile.active_glossaries));
        localStorage.setItem('zoutty_onboarding_completed', 'true');
        setHasCompletedOnboarding(true);
        setOnboardingTourStep(null);
      } else if (hasUsage) {
        localStorage.setItem('zoutty_onboarding_completed', 'true');
        setHasCompletedOnboarding(true);
        setOnboardingTourStep(null);
      } else if (localStorage.getItem('zoutty_onboarding_completed') !== 'true') {
        // Brand new account: Trigger onboarding tour
        setOnboardingTourStep(prev => (prev === null ? 0 : prev));
      }

      if (profile || usage) {
        // We only sync to devState if Mock Mode is disabled, to avoid wiping out testing progress!
        // But wait, the user's requirement is: "When I disable mock mode, it goes back to my 1 session and 1 clip".
        // It's best to always sync the cloud data if mockGemini is OFF.
        const current = getDevState();
        if (!current.mockGemini) {
          syncWithCloudProfile(profile, usage);
        }
      }
    } catch (err) {
      console.warn('[CloudSync] Failed to fetch profile and usage:', err);
    }
  }, []);

  const handleOpenBillingPortal = useCallback(async () => {
    setIsPortalLoading(true);
    showToast(t('billing.plans.portalRedirecting'));
    const portalRes = await openStripeCustomerPortal();
    setIsPortalLoading(false);
    if (portalRes.mock) {
      showToast(t('billing.plans.portalSimulated'));
    }
  }, [t]);

  const redeemPendingReferral = useCallback(async (token?: string) => {
    const pendingCode = localStorage.getItem('zoutty_referral_signup_code');
    if (!pendingCode) return;

    try {
      const res = await fetch('/api/referrals/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ referralCode: pendingCode }),
      });
      const data = await res.json();
      localStorage.removeItem('zoutty_referral_signup_code');
      if (data.success) {
        showToast(t('billing.referrals.linkedToast'), false, undefined, undefined, undefined, 'success');
        fetchReferralStats();
      } else if (data.error && (data.error.includes('own referral code') || data.error.includes('own code'))) {
        showToast(t('billing.referrals.ownCodeNotice'), false, undefined, undefined, undefined, 'warning');
      }
    } catch (err) {
      console.warn('[Referral] Could not redeem referral code:', err);
    }
  }, [fetchReferralStats, t]);

  useEffect(() => {
    const handleDevChange = (e: any) => {
      setDevState(e.detail || getDevState());
    };
    window.addEventListener('zoutty-dev-state-changed', handleDevChange);

    // Handle Stripe checkout return params & Referral URL params
    try {
      const urlParams = new URLSearchParams(window.location.search);
      
      // Capture referral link param (?ref=...)
      const refParam = urlParams.get('ref');
      if (refParam) {
        const cleanRef = refParam.trim().toUpperCase();
        if (cleanRef) {
          localStorage.setItem('zoutty_referral_signup_code', cleanRef);
          console.log(`[Referral] Captured referral code from URL: ${cleanRef}`);
        }
      }

      if (urlParams.get('topup_success') === 'true') {
        const current = getDevState();
        const updated = saveDevState({
          topup_extra_sessions: (current.topup_extra_sessions || 0) + 10,
          topup_extra_clips: (current.topup_extra_clips || 0) + 100,
        });
        setDevState(updated);
        setShowTopupSuccessModal(true);
        window.history.replaceState({}, '', window.location.pathname);
      } else if (urlParams.get('topup_canceled') === 'true') {
        showToast(t('billing.topup.canceledToast'), false, undefined, undefined, undefined, 'warning');
        window.history.replaceState({}, '', window.location.pathname);
      } else if (urlParams.get('checkout_success') === 'true') {
        const rawTier = urlParams.get('tier') || '';
        const sessionId = urlParams.get('session_id') || '';
        // If Stripe appended duplicate query strings (e.g. "student/?checkout_success..."),
        // use .includes() to safely extract the correct tier.
        const targetTier: 'student' | 'teacher' = rawTier.includes('teacher') ? 'teacher' : 'student';
        const updated = saveDevState({
          tier: targetTier,
          subscription_status: 'active',
          period_sessions: 0,
          period_clips: 0,
        });
        setDevState(updated);
        setShowSubscriptionSuccessModal({ isOpen: true, tier: targetTier });
        window.history.replaceState({}, '', window.location.pathname);

        // Confirm session on backend to immediately update DB & transition referral rewards
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.access_token) {
            fetch('/api/stripe/confirm-session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ sessionId, tier: targetTier }),
            })
              .then(() => fetchReferralStats())
              .catch((err) => console.warn('[Stripe] Could not confirm session:', err));
          }
        });
      } else if (urlParams.get('checkout_canceled') === 'true') {
        showToast(t('billing.plans.checkoutCanceledToast'), false, undefined, undefined, undefined, 'warning');
        window.history.replaceState({}, '', window.location.pathname);
      } else if (urlParams.get('portal_simulated') === 'true') {
        showToast(t('billing.plans.portalSimulated'));
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (e) {
      console.warn('[Stripe/Referral] Query param parsing error:', e);
    }

    return () => window.removeEventListener('zoutty-dev-state-changed', handleDevChange);
  }, [t]);

  useEffect(() => {
    if (showReferralModal) {
      fetchReferralStats();
    }
  }, [showReferralModal, fetchReferralStats]);

  useEffect(() => {
    if (showAppSettings) {
      const currentName = devState.display_name || session?.user?.user_metadata?.display_name || session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || '';
      setEditDisplayName(currentName);
      if (session?.access_token) {
        fetchCloudProfileAndUsage(session.access_token);
      }
      checkUserHasPassword();
    }
  }, [showAppSettings, devState.display_name, session, fetchCloudProfileAndUsage, checkUserHasPassword]);
  const [restoreBackupFile, setRestoreBackupFile] = useState<File | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isStorageFull, setIsStorageFull] = useState(false);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [storageBannerDismissed, setStorageBannerDismissed] = useState(false);
  const [offlineBannerDismissed, setOfflineBannerDismissed] = useState(false);
  const [showBothFailed, setShowBothFailed] = useState(false);
  const [isInitialSync, setIsInitialSync] = useState(() => localStorage.getItem('zoutty_initial_sync_pending') === 'true');
  const [showSyncConflict, setShowSyncConflict] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(() => localStorage.getItem('zoutty_guest_mode') === 'true');
  const [activeGlossaryIds, setActiveGlossaryIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('zoutty_active_glossaries');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showMandatoryGlossaryModal, setShowMandatoryGlossaryModal] = useState(false);

  const updateActiveGlossaryIds = async (nextIds: string[]) => {
    setActiveGlossaryIds(nextIds);
    localStorage.setItem('zoutty_active_glossaries', JSON.stringify(nextIds));

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (authSession?.user?.id) {
        await supabase
          .from('profiles')
          .update({ active_glossaries: nextIds })
          .eq('id', authSession.user.id);
      }
    } catch (err) {
      console.warn('[ProfileSync] Failed to sync active_glossaries to profiles table:', err);
    }
  };
  
  useEffect(() => {
    // Show when onboarding is done and no glossaries/dance styles are selected yet (including guest mode)
    if (hasCompletedOnboarding && activeGlossaryIds.length === 0) {
      setShowMandatoryGlossaryModal(true);
    } else {
      setShowMandatoryGlossaryModal(false);
    }
  }, [hasCompletedOnboarding, activeGlossaryIds]);
  const initialSyncCheckedRef = useRef(false);

  const finishInitialSync = useCallback(async () => {
    try {
      await syncEngine.syncAll();
    } catch (err) {
      console.warn('[Sync] finishInitialSync error:', err);
    } finally {
      localStorage.removeItem('zoutty_initial_sync_pending');
      setIsInitialSync(false);
      setShowSyncConflict(false);
      setIsLoadingData(false);
    }
  }, []);

  const handleInitialSyncCheck = useCallback(async (currentSession: any) => {
    if (initialSyncCheckedRef.current) return;
    initialSyncCheckedRef.current = true;
    
    try {
      await migrateOldData();
      if (localStorage.getItem('zoutty_initial_sync_pending') === 'true') {
        const { hasLocalPending, hasCloudData } = await syncEngine.checkInitialSyncConflicts(currentSession.user.id);
        if (hasLocalPending && hasCloudData) {
          setShowSyncConflict(true);
        } else {
          await syncEngine.syncAll();
        }
      } else {
        syncEngine.syncAll();
      }
    } catch (err) {
      console.error('[InitialSyncCheck] Error checking sync conflicts, finishing sync gracefully:', err);
      finishInitialSync();
    }
  }, [finishInitialSync]);

  // Safety timeout: Never leave user stuck on initial sync spinner for more than 5s
  useEffect(() => {
    if (isInitialSync && !showSyncConflict) {
      const timer = setTimeout(() => {
        console.warn('[InitialSync] Safety timeout reached (5s), unlocking UI...');
        finishInitialSync();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isInitialSync, showSyncConflict, finishInitialSync]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitializingAuth(false);
      if (session) {
        handleInitialSyncCheck(session);
        redeemPendingReferral(session.access_token);
        fetchReferralStats();
        fetchCloudProfileAndUsage(session.access_token);
        checkUserHasPassword();
      } else {
        finishInitialSync();
      }
    }).catch(err => {
      console.error('[Auth] getSession error:', err);
      setIsInitializingAuth(false);
      finishInitialSync();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        handleInitialSyncCheck(session);
        redeemPendingReferral(session.access_token);
        fetchReferralStats();
        fetchCloudProfileAndUsage(session.access_token);
        checkUserHasPassword();
      } else {
        finishInitialSync();
      }
    });

    const handleDbWrite = () => {
      if (localStorage.getItem('zoutty_initial_sync_pending') !== 'true') {
        syncEngine.scheduleSync();
      }
    };
    const handleStorageFull = () => setIsStorageFull(true);
    const handleStorageFullClear = () => setIsStorageFull(false);
    const handleBothFailed = () => setShowBothFailed(true);
    
    const handleOffline = () => {
      setIsOffline(true);
      setOfflineBannerDismissed(false);
    };
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('zoutty-db-write', handleDbWrite);
    window.addEventListener('zoutty-storage-full', handleStorageFull);
    window.addEventListener('zoutty-storage-full-clear', handleStorageFullClear);
    window.addEventListener('zoutty-both-failed', handleBothFailed);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('zoutty-db-write', handleDbWrite);
      window.removeEventListener('zoutty-storage-full', handleStorageFull);
      window.removeEventListener('zoutty-storage-full-clear', handleStorageFullClear);
      window.removeEventListener('zoutty-both-failed', handleBothFailed);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [handleInitialSyncCheck, finishInitialSync]);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // New features state
  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [glossaries, setGlossaries] = useState<DanceGlossary[]>([]);

  const [folderModal, setFolderModal] = useState<{ type: 'create' | 'rename', id?: string, name: string } | null>(null);
  const [deleteFolderModal, setDeleteFolderModal] = useState<{ id: string, name: string } | null>(null);
  const [deleteFolderAlsoSessions, setDeleteFolderAlsoSessions] = useState(false);

  // Search state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [activeSearch, setActiveSearch] = useState<{
    query: string;
    filters: SearchFilters;
    matchedSessionIds: Set<string>;
    matchedGroupIds: Set<string>;
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearchConfirm = async (query: string, filters: SearchFilters) => {
    setIsSearching(true);
    setShowSearchModal(false);
    try {
      const reports = await db.getFinalReports();
      const allMedia = await db.getAllMedia();
      const { matchedSessionIds, matchedGroupIds } = performSearch(
        query,
        filters,
        sessions,
        groups,
        Object.values(audioEntries),
        reports,
        allMedia
      );
      setActiveSearch({ query, filters, matchedSessionIds, matchedGroupIds });
    } catch (e) {
      console.error(e);
      setToastMessage({ text: 'Error performing search', isError: true });
    } finally {
      setIsSearching(false);
    }
  };
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [exportIncludeAudioTranscripts, setExportIncludeAudioTranscripts] = useState(true);

  const [shareModal, setShareModal] = useState<{
    sessionId: string;
    shareReport: boolean;
    shareNotes: boolean;
    shareTranscripts: boolean;
    shareStrictSummary: boolean;
    shareDrills: boolean;
    shareHomework: boolean;
    shareTechnical: boolean;
    shareEmotional: boolean;
    shareMedia: boolean;
    hasHeavyMedia?: boolean;
    generatedLink?: string;
    shareCode?: string;
    shareTimestamp?: number;
    availableReport: boolean;
    availableNotes: boolean;
    availableTranscripts: boolean;
    availableStrictSummary: boolean;
    availableDrills: boolean;
    availableHomework: boolean;
    availableTechnical: boolean;
    availableEmotional: boolean;
    availableMedia: boolean;
    viewState?: 'checklist' | 'active_code' | 'active_file';
    shareMethod?: 'code' | 'link' | 'file';
    sharedContent?: { report: boolean; notes: boolean; transcripts: boolean; media: boolean; };
  } | null>(null);
  const [moveSessionModal, setMoveSessionModal] = useState<{ sessionId: string, currentGroupId?: string } | null>(null);
  const [sessionSortBy, setSessionSortBy] = useState<'date' | 'name' | 'created'>(
    (localStorage.getItem('zoutty_session_sort_by') as any) || 'date'
  );
  const [sessionSortOrder, setSessionSortOrder] = useState<'asc' | 'desc'>(
    (localStorage.getItem('zoutty_session_sort_order') as any) || 'desc'
  );
  const [folderSortBy, setFolderSortBy] = useState<'date' | 'name' | 'created'>(
    (localStorage.getItem('zoutty_folder_sort_by') as any) || 'date'
  );
  const [folderSortOrder, setFolderSortOrder] = useState<'asc' | 'desc'>(
    (localStorage.getItem('zoutty_folder_sort_order') as any) || 'desc'
  );
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [showImportCodeModal, setShowImportCodeModal] = useState(false);
  const [importCodeValue, setImportCodeValue] = useState('');

  // Browser History Navigation Sync
  const navigateTo = (newView: 'list' | 'detail', newSessionId: string | null, newGroupId: string | null, historyAction: 'push' | 'replace' | 'none' = 'push') => {
    setView(newView);
    setSelectedSessionId(newSessionId);
    setSelectedGroupId(newGroupId);

    window.scrollTo(0, 0);

    if (historyAction === 'push') {
      window.history.pushState({
        view: newView,
        selectedSessionId: newSessionId,
        selectedGroupId: newGroupId
      }, '');
    } else if (historyAction === 'replace') {
      window.history.replaceState({
        view: newView,
        selectedSessionId: newSessionId,
        selectedGroupId: newGroupId
      }, '');
    }
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      if (state) {
        setView(state.view || 'list');
        setSelectedSessionId(state.selectedSessionId || null);
        setSelectedGroupId(state.selectedGroupId || null);
      } else {
        setView('list');
        setSelectedSessionId(null);
        setSelectedGroupId(null);
      }
      window.scrollTo(0, 0);
    };

    window.addEventListener('popstate', handlePopState);

    // Initialize root history state if we are launching on standard home view
    window.history.replaceState({
      view: 'list',
      selectedSessionId: null,
      selectedGroupId: null
    }, '');

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const getSessionLastActivity = (session: Session) => {
    const sessionAudios = Object.values(audioEntries).filter(e => e.sessionId === session.id);
    const audioMax = sessionAudios.length > 0 ? Math.max(...sessionAudios.map(a => a.timestamp)) : 0;
    return Math.max(session.lastModified || 0, session.date, audioMax);
  };

  const formatCompactRelativeDate = (timestamp: number) => {
    const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSeconds < 60) {
      return t('home.timeJustNow');
    }
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return t('home.timeMinutesAgo', { count: diffMinutes });
    }
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return t('home.timeHoursAgo', { count: diffHours });
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
      return t('home.timeDaysAgo', { count: diffDays });
    }
    const d = new Date(timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthsEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const month = uiLanguage === 'es' ? monthsEs[d.getMonth()] : monthsEn[d.getMonth()];
    return `${day} ${month}`;
  };

  const getFolderLastActivity = (group: SessionGroup) => {
    const folderSessions = sessions.filter(s => s.groupId === group.id);
    if (folderSessions.length === 0) return group.dateCreated;
    return Math.max(...folderSessions.map(s => getSessionLastActivity(s)));
  };

  const sortFolders = (foldersList: SessionGroup[]) => {
    return [...foldersList].sort((a, b) => {
      let valA: any;
      let valB: any;
      if (folderSortBy === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
        return folderSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (folderSortBy === 'created') {
        valA = a.dateCreated;
        valB = b.dateCreated;
      } else {
        valA = getFolderLastActivity(a);
        valB = getFolderLastActivity(b);
      }
      return folderSortOrder === 'asc' ? valA - valB : valB - valA;
    });
  };

  const sortSessions = (sessionsList: Session[]) => {
    return [...sessionsList].sort((a, b) => {
      let valA: any;
      let valB: any;
      if (sessionSortBy === 'name') {
        valA = a.title.toLowerCase();
        valB = b.title.toLowerCase();
        return sessionSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sessionSortBy === 'created') {
        valA = a.date;
        valB = b.date;
      } else {
        valA = getSessionLastActivity(a);
        valB = getSessionLastActivity(b);
      }
      return sessionSortOrder === 'asc' ? valA - valB : valB - valA;
    });
  };

  const handleSessionSortClick = (field: 'date' | 'name' | 'created') => {
    let nextOrder: 'asc' | 'desc';
    let nextField = sessionSortBy;
    if (sessionSortBy === field) {
      nextOrder = sessionSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      nextField = field;
      nextOrder = field === 'name' ? 'asc' : 'desc';
    }
    setSessionSortBy(nextField);
    setSessionSortOrder(nextOrder);
    localStorage.setItem('zoutty_session_sort_by', nextField);
    localStorage.setItem('zoutty_session_sort_order', nextOrder);
  };

  const handleFolderSortClick = (field: 'date' | 'name' | 'created') => {
    let nextOrder: 'asc' | 'desc';
    let nextField = folderSortBy;
    if (folderSortBy === field) {
      nextOrder = folderSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      nextField = field;
      nextOrder = field === 'name' ? 'asc' : 'desc';
    }
    setFolderSortBy(nextField);
    setFolderSortOrder(nextOrder);
    localStorage.setItem('zoutty_folder_sort_by', nextField);
    localStorage.setItem('zoutty_folder_sort_order', nextOrder);
  };


  // Listen for beforeinstallprompt for PWA install button
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('beforeinstallprompt event fired');
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Load from IndexedDB on mount
  useEffect(() => {
    if (sessionStorage.getItem('zoutty_show_restore_animation') === 'true') {
      sessionStorage.removeItem('zoutty_show_restore_animation');
      setLogoAnimationType('restore');
    }

    const loadData = async () => {
      try {
        let loadedSessions = await db.getSessions();
        let loadedAudios = await db.getAudioEntries();
        let loadedGroups = await db.getGroups();

        // ── Cloud read fallback: if local DB is empty and user is signed in, read from Supabase ──
        if (loadedSessions.length === 0) {
          try {
            const { data: { session: authSession } } = await supabase.auth.getSession();
            if (authSession?.user) {
              console.log('[LoadData] Local DB empty — attempting cloud read fallback...');
              const cloudData = await readFromCloud(authSession.user.id);
              if (cloudData.sessions.length > 0) {
                console.log('[LoadData] Cloud read fallback succeeded.');
                loadedSessions = cloudData.sessions;
                loadedAudios = cloudData.audios;
                loadedGroups = cloudData.groups;
              }
            }
          } catch (cloudErr) {
            console.error('[LoadData] Cloud read fallback also failed:', cloudErr);
          }
        }

        const loadedGlossaries = SYSTEM_GLOSSARIES;

        // Sort sessions by date descending
        loadedSessions.sort((a, b) => b.date - a.date);
        setSessions(loadedSessions);
        setGroups(loadedGroups);
        setGlossaries(loadedGlossaries);

        // Convert audio entries array to record for easy lookup
        const audioRecord: Record<string, AudioEntry> = {};
        loadedAudios.forEach(a => audioRecord[a.id] = a);
        setAudioEntries(audioRecord);

        if (loadedSessions.length === 0 && !localStorage.getItem('zoutty_has_launched')) {
          // We no longer trigger the animation here. It will trigger after the Glossary modal.
        }
      } catch (err) {
        console.error("Failed to load IndexedDB", err);
        showToast(t('toast.failedLoadData'), true);
      } finally {
        setIsLoadingData(false);
      }
    };
    loadData();

    const handleSyncComplete = async () => {
      await loadData();
      if (localStorage.getItem('zoutty_initial_sync_pending')) {
        localStorage.removeItem('zoutty_initial_sync_pending');
        setIsInitialSync(false);
      }
    };
    window.addEventListener('zoutty-sync-complete', handleSyncComplete);

    return () => {
      window.removeEventListener('zoutty-sync-complete', handleSyncComplete);
    };
  }, []);

  const showToast = (
    text: string,
    isError = false,
    actionText?: string,
    onAction?: () => void,
    duration?: number,
    variant?: 'success' | 'error' | 'warning' | 'info'
  ) => setToastMessage({ text, isError, actionText, onAction, duration, variant });
  const showSpinner = (text: string, onCancel?: () => void) => setSpinnerConfig({ text, onCancel });
  const hideSpinner = () => setSpinnerConfig(null);

  const handleExportBackup = async () => {
    showSpinner('Creating backup...');
    try {
      const backup = await db.exportDatabase();
      const json = JSON.stringify(backup);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zoutty-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(t('toast.backupDownloaded'));
    } catch (e) {
      console.error("Backup failed", e);
      showToast(t('toast.failedBackup'), true);
    } finally {
      hideSpinner();
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreBackupFile(file);
    e.target.value = '';
  };

  const executeImportBackup = async (file: File, merge: boolean) => {
    setRestoreBackupFile(null);
    showSpinner('Restoring database...');
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!merge && session?.user) {
        await syncEngine.wipeCloudData(session.user.id);
      }
      await db.importDatabase(backup, { merge });
      showToast(t('toast.restoreSuccess'));
      sessionStorage.setItem('zoutty_show_restore_animation', 'true');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("Restore failed", err);
      showToast(t('toast.failedRestore'), true);
    } finally {
      hideSpinner();
    }
  };

  const handleResetApp = async () => {
    setShowResetConfirm(false);
    showSpinner('Resetting Zoutty data...');
    try {
      if (session?.user) {
        await syncEngine.wipeCloudData(session.user.id);
      }
      await db.clearDatabase();
      showToast(t('toast.resetSuccess'));
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("Reset failed", err);
      showToast(t('toast.failedReset'), true);
    } finally {
      hideSpinner();
    }
  };

  const handleSaveDisplayName = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!session?.user?.id) return;
    const trimmed = editDisplayName.trim();
    if (!trimmed) return;
    setIsSavingDisplayName(true);
    try {
      const [{ error: profileErr }, { error: authErr }] = await Promise.all([
        supabase.from('profiles').update({ display_name: trimmed }).eq('id', session.user.id),
        supabase.auth.updateUser({ data: { display_name: trimmed } })
      ]);
      if (profileErr && authErr) throw profileErr;
      saveDevState({ display_name: trimmed });
      showToast(t('appSettings.displayNameUpdated'), false, undefined, undefined, undefined, 'success');
    } catch (err: any) {
      console.error('[SaveDisplayName] Failed:', err);
      showToast(err.message || t('auth.authFailed'), true);
    } finally {
      setIsSavingDisplayName(false);
    }
  };

  const isEmailAuthUser = session?.user?.app_metadata?.provider === 'email' ||
    session?.user?.app_metadata?.providers?.includes('email') ||
    Boolean(session?.user?.identities?.some((i: any) => i.provider === 'email')) ||
    session?.user?.user_metadata?.has_password === true;

  const userHasPassword = hasPasswordSet !== null ? hasPasswordSet : isEmailAuthUser;

  const handleUpdatePassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!session?.user?.email) return;

    if (newPassword !== confirmNewPassword) {
      showToast(t('appSettings.passwordsDoNotMatch'), true);
      return;
    }
    if (newPassword.length < 6) {
      showToast(t('appSettings.passwordTooShort'), true);
      return;
    }

    setIsUpdatingPassword(true);
    try {
      // If user already has a password set, verify current password first
      if (userHasPassword) {
        if (!currentPassword) {
          showToast(t('appSettings.currentPasswordIncorrect'), true);
          setIsUpdatingPassword(false);
          return;
        }
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email: session.user.email,
          password: currentPassword,
        });
        if (verifyErr) {
          showToast(t('appSettings.currentPasswordIncorrect'), true);
          setIsUpdatingPassword(false);
          return;
        }
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
        data: { has_password: true },
      });
      if (updateErr) throw updateErr;

      setHasPasswordSet(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      showToast(t('appSettings.passwordUpdated'), false, undefined, undefined, undefined, 'success');
    } catch (err: any) {
      console.error('[UpdatePassword] Failed:', err);
      showToast(err.message || t('auth.authFailed'), true);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!session?.user?.id) return;
    setIsDeletingAccount(true);
    setShowDeleteAccountModal(false);
    showSpinner(t('common.processing'));
    try {
      const token = session?.access_token;
      const res = await fetch('/api/user/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Failed to delete account (status ${res.status})`);
      }

      // 1. Clear IndexedDB
      await db.clearDatabase();

      // 2. Clear LocalStorage (preserve user's selected language)
      const savedLang = localStorage.getItem('zoutty_language');
      localStorage.clear();
      if (savedLang) {
        localStorage.setItem('zoutty_language', savedLang);
      }

      // 3. Sign out
      await supabase.auth.signOut();

      // 4. Reload page
      window.location.reload();
    } catch (err: any) {
      console.error('[DeleteAccount] Failed:', err);
      showToast(err.message || t('appSettings.deleteAccountFailed'), true);
      setIsDeletingAccount(false);
      hideSpinner();
    }
  };



  // Migration: Update old session titles to new format
  useEffect(() => {
    const migrateTitles = async () => {
      // Matches "Fri, Feb 27, 2026"
      const oldFormatRegex = /^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}, \d{4}$/;
      const needsMigration = sessions.filter(s => oldFormatRegex.test(s.title));

      if (needsMigration.length > 0) {
        console.log(`[Migration] Updating ${needsMigration.length} session titles to new format`);
        const updatedSessions = [...sessions];
        let changed = false;

        for (const session of needsMigration) {
          const newTitle = getSessionDefaultTitle(session.date, uiLanguage);
          const idx = updatedSessions.findIndex(s => s.id === session.id);
          if (idx !== -1) {
            updatedSessions[idx] = { ...updatedSessions[idx], title: newTitle };
            await db.saveSession(updatedSessions[idx]);
            changed = true;
          }
        }

        if (changed) {
          setSessions(updatedSessions);
        }
      }
    };
    if (sessions.length > 0) {
      migrateTitles();
    }
  }, [sessions.length > 0]); // Run once when sessions are loaded

  // Migration 2: Retroactively clean up old technical summaries from audio clips
  // Now that consolidation handles all summaries, we want old individual clips to just show transcripts
  useEffect(() => {
    const cleanOldAudioEntries = async () => {
      const keys = Object.keys(audioEntries);
      if (keys.length === 0) return;

      let changedCount = 0;
      const updatedEntries = { ...audioEntries };

      for (const id of keys) {
        const entry: any = updatedEntries[id];
        let needsSave = false;

        // Remove old shape keys if present
        if (entry.strictSummary) { delete entry.strictSummary; needsSave = true; }
        if (entry.expandedInsights) { delete entry.expandedInsights; needsSave = true; }
        if (entry.processedData) { delete entry.processedData; needsSave = true; }
        if (entry.bulletPoints) { delete entry.bulletPoints; needsSave = true; }

        if (needsSave) {
          await db.saveAudioEntry(entry);
          changedCount++;
        }
      }

      if (changedCount > 0) {
        console.log(`[Migration] Cleaned up legacy summary data from ${changedCount} audio entries`);
        setAudioEntries(updatedEntries);
      }
    };

    cleanOldAudioEntries();
  }, [Object.keys(audioEntries).length > 0]); // Trigger once entries load


  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  const allExistingTopics = useMemo(() => {
    const topicMap = new Map<string, string>();
    sessions.forEach(s => {
      (s.tags || []).forEach(tag => {
        const norm = normalizeSearchText(tag);
        if (norm && !topicMap.has(norm)) {
          topicMap.set(norm, tag.trim());
        }
      });
    });
    return Array.from(topicMap.values()).sort((a, b) => a.localeCompare(b));
  }, [sessions]);

  // Load media for the selected session whenever it changes
  useEffect(() => {
    if (!selectedSessionId) {
      setSessionMedia([]);
      return;
    }
    db.getSessionMedia(selectedSessionId).then(items => setSessionMedia(items)).catch(console.error);
  }, [selectedSessionId]);

  const handleOpenNewSession = () => {
    if (onboardingTourStep === 1) {
      handleTourNext();
      return;
    }
    setShowNewSessionModal(true);
  };

  const addAudioEntry = async (
    sessionId: string,
    blob: Blob,
    language: Language,
    type: 'recording' | 'upload',
    filename?: string,
    silent = false
  ) => {
    const entryId = crypto.randomUUID();

    const newEntry: AudioEntry = {
      id: entryId,
      sessionId,
      timestamp: Date.now(),
      language,
      type,
      filename,
      audioBlob: blob,
    };

    try {
      // Save to IndexedDB and update UI
      await db.saveAudioEntry(newEntry);
      setAudioEntries(prev => ({ ...prev, [entryId]: newEntry }));
      if (silent) return;
      const sessionEntries = Object.values(audioEntries).filter(e => e.sessionId === sessionId);
      if (sessionEntries.length === 1 && !localStorage.getItem('hasShownConsolidationHint')) {
        localStorage.setItem('hasShownConsolidationHint', 'true');
        // Show the hint instead of the default toast
        showToast(t('onboarding.hintConsolidation'), false, undefined, undefined, 10000);
      } else {
        showToast(filename ? t('toast.fileAdded', { filename }) : t('toast.audioAdded'));
      }
    } catch (err) {
      console.error('Failed to save audio to database:', err);
      showToast(t('toast.failedSaveAudio'), true);
    }
  };

  const processAndSaveVideo = async (
    file: File,
    sessionId: string,
    language: Language
  ): Promise<boolean> => {
    showSpinner(t('toast.processingVideo'));
    try {
      let extracted: ExtractedAudioResult | null = null;
      try {
        extracted = await extractAudioFromVideo(file);
      } catch (err: any) {
        console.warn('[processAndSaveVideo] Audio extraction warning:', err);
        const isNoAudio = err?.message?.toLowerCase().includes('no audio');
        if (isNoAudio) {
          const videoMediaItem: SessionMedia = {
            id: crypto.randomUUID(),
            sessionId,
            timestamp: Date.now(),
            filename: file.name,
            mimeType: file.type || 'video/mp4',
            size: file.size,
            storageMode: 'blob',
            blob: file,
            isLessonVideo: true
          };
          await db.saveMediaItem(videoMediaItem);
          setSessionMedia(prev => [...prev, videoMediaItem]);
          showToast(t('toast.noAudioInVideo'), true);
          return true;
        }
        throw err;
      }

      if (extracted.duration > TIER_LIMITS.MAX_CLIP_DURATION_SECONDS) {
        setShowDurationExceededModal({
          isOpen: true,
          files: [{ name: file.name, duration: extracted.duration }]
        });
        return false;
      }

      await addAudioEntry(sessionId, extracted.blob, language, 'upload', extracted.filename);

      const videoMediaItem: SessionMedia = {
        id: crypto.randomUUID(),
        sessionId,
        timestamp: Date.now(),
        filename: file.name,
        mimeType: file.type || 'video/mp4',
        size: file.size,
        storageMode: 'blob',
        blob: file,
        isLessonVideo: true
      };
      await db.saveMediaItem(videoMediaItem);
      setSessionMedia(prev => [...prev, videoMediaItem]);
      showToast(t('toast.videoSavedToGallery'));
      return true;
    } catch (err: any) {
      console.error('[processAndSaveVideo] Failed to process video:', err);
      showToast(t('toast.failedExtractAudio'), true);
      return false;
    } finally {
      hideSpinner();
    }
  };

  const handleSelectEntryOption = async (option: EntryOption, file?: File) => {
    setShowNewSessionModal(false);

    if (file) {
      if (option === 'video') {
        const newSession: Session = {
          id: crypto.randomUUID(),
          title: getSessionDefaultTitle(Date.now(), uiLanguage),
          subtitle: '',
          date: Date.now(),
          groupId: selectedGroupId || undefined,
          glossaryId: 'auto'
        };
        try {
          await db.saveSession(newSession);
          setSessions(prev => [newSession, ...prev]);
          setPendingSessionAction(null);
          navigateTo('detail', newSession.id, selectedGroupId);
          await processAndSaveVideo(file, newSession.id, uiLanguage);
        } catch (err) {
          console.error('Failed to create session for video:', err);
          showToast(t('toast.failedSaveSession'), true);
        }
        return;
      }

      if (option === 'audio') {
        const duration = await getMediaDuration(file);
        if (duration > TIER_LIMITS.MAX_CLIP_DURATION_SECONDS) {
          setShowDurationExceededModal({
            isOpen: true,
            files: [{ name: file.name, duration }]
          });
          return;
        }
        const newSession: Session = {
          id: crypto.randomUUID(),
          title: getSessionDefaultTitle(Date.now(), uiLanguage),
          subtitle: '',
          date: Date.now(),
          groupId: selectedGroupId || undefined,
          glossaryId: 'auto'
        };
        try {
          await db.saveSession(newSession);
          setSessions(prev => [newSession, ...prev]);
          setPendingSessionAction(null);
          await addAudioEntry(newSession.id, file, uiLanguage, 'upload', file.name);
          navigateTo('detail', newSession.id, selectedGroupId);
        } catch (err) {
          console.error('Failed to create session for audio:', err);
          showToast(t('toast.failedSaveSession'), true);
        }
        return;
      }
    }

    const newSession: Session = {
      id: crypto.randomUUID(),
      title: getSessionDefaultTitle(Date.now(), uiLanguage),
      subtitle: '',
      date: Date.now(),
      groupId: selectedGroupId || undefined,
      glossaryId: 'auto'
    };

    try {
      await db.saveSession(newSession);

      setSessions(prev => [newSession, ...prev]);

      if (option === 'record') {
        setPendingSessionAction('record');
      } else if (option === 'audio') {
        setPendingSessionAction('upload_audio');
      } else if (option === 'video') {
        setPendingSessionAction('upload_video');
      } else {
        setPendingSessionAction(null);
      }

      navigateTo('detail', newSession.id, selectedGroupId);
    } catch (err) {
      console.error('Failed to save session:', err);
      showToast(t('toast.failedSaveSession'), true);
    }
  };

  const createSession = async () => {
    const newSession: Session = {
      id: crypto.randomUUID(),
      title: getSessionDefaultTitle(Date.now(), uiLanguage),
      subtitle: '',
      date: Date.now(),
      groupId: selectedGroupId || undefined,
      glossaryId: 'auto' // default to auto-detect
    };

    try {
      await db.saveSession(newSession);

      setSessions(prev => {
        const next = [newSession, ...prev];
        return next;
      });
      navigateTo('detail', newSession.id, selectedGroupId);
    } catch (err) {
      console.error('Failed to save session:', err);
      showToast(t('toast.failedSaveSession'), true);
    }
  };

  const updateSession = async (id: string, changes: Partial<Session>) => {
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    const updated: Session = {
      ...session,
      ...changes,
      lastModified: changes.lastModified ?? Date.now()
    };
    try {
      await db.saveSession(updated);
      setSessions(prev => prev.map(s => s.id === id ? updated : s));
    } catch (err) {
      console.error('Failed to update session:', err);
      showToast(t('toast.failedSaveSession'), true);
    }
  };

  const updateAudioEntry = async (id: string, changes: Partial<AudioEntry>) => {
    const entry = audioEntries[id];
    if (!entry) return;
    const updated = { ...entry, ...changes };
    try {
      await db.saveAudioEntry(updated);
      setAudioEntries(prev => ({ ...prev, [id]: updated }));
    } catch (err) {
      console.error('Failed to update audio entry:', err);
      showToast(t('toast.failedSaveAudio'), true);
    }
  };

  const handleUndo = (id: string, type: 'session' | 'audio', data: any, extraData: any, timeoutId: NodeJS.Timeout) => {
    clearTimeout(timeoutId);
    if (type === 'session') {
      setSessions(prev => [data, ...prev].sort((a, b) => b.date - a.date));
      const audios = extraData as AudioEntry[];
      if (audios) {
        setAudioEntries(prev => {
          const copy = { ...prev };
          audios.forEach(a => copy[a.id] = a);
          return copy;
        });
      }
    } else {
      setAudioEntries(prev => ({ ...prev, [id]: data }));
    }
    showToast(t('toast.actionUndone'));
  };

  const deleteAudioEntry = async (audioOrId: AudioEntry | string) => {
    const audio = typeof audioOrId === 'string'
      ? (audioEntries[audioOrId] || (await db.getAudioEntries(true)).find(a => a.id === audioOrId))
      : audioOrId;
    const id = typeof audioOrId === 'string' ? audioOrId : audioOrId.id;

    await db.deleteAudioEntry(id);

    try {
      let path = audio?.audio_storage_path;
      if (!path) {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (authSession?.user?.id && audio?.sessionId && id) {
          path = `${authSession.user.id}/${audio.sessionId}/${id}.webm`;
        }
      }
      if (path) {
        const results = await Promise.allSettled([
          supabase.storage.from('sessionMedia').remove([path]),
          supabase.storage.from('audios').remove([path])
        ]);
        console.log('[Storage] deleteAudioEntry remove results:', { path, results });
      }
    } catch (err) {
      console.error('[Storage] Failed to remove audio file from storage:', err);
    }
  };

  const deleteMediaItem = async (mediaOrId: SessionMedia | string) => {
    const media = typeof mediaOrId === 'string'
      ? (sessionMedia.find(m => m.id === mediaOrId) || (await db.getAllMedia(true)).find(m => m.id === mediaOrId))
      : mediaOrId;
    const id = typeof mediaOrId === 'string' ? mediaOrId : mediaOrId.id;

    await db.deleteMediaItem(id);

    try {
      let path = media?.media_storage_path;
      if (!path) {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (authSession?.user?.id && media?.sessionId && id) {
          const extMatch = media.filename?.match(/\.([^.]+)$/);
          const ext = extMatch ? `.${extMatch[1]}` : '';
          path = `${authSession.user.id}/${media.sessionId}/${id}${ext}`;
        }
      }
      if (path) {
        const { data, error } = await supabase.storage.from('sessionMedia').remove([path]);
        console.log('[Storage] deleteMediaItem remove result:', { path, data, error });
        if (error) {
          console.error('[Storage] Supabase storage remove error:', error);
        } else if (data && data.length === 0) {
          console.warn('[Storage] Supabase storage returned 0 deleted files. Check RLS DELETE policy on storage.objects for bucket "sessionMedia".');
        }
      }
    } catch (err) {
      console.error('[Storage] Failed to remove media file from storage:', err);
    }
  };

  const purgeSessionStorageFolder = async (sessionId: string) => {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.user?.id) return;
      const userId = authSession.user.id;
      const folderPath = `${userId}/${sessionId}`;

      for (const bucket of ['sessionMedia', 'audios'] as const) {
        try {
          const { data: files, error } = await supabase.storage.from(bucket).list(folderPath, { limit: 100 });
          if (!error && files && files.length > 0) {
            const filePaths = files.map(f => `${folderPath}/${f.name}`);
            const { data: removedData, error: removeError } = await supabase.storage.from(bucket).remove(filePaths);
            console.log(`[Storage] Purged leftover files in ${bucket} for session ${sessionId}:`, { filePaths, removedData, removeError });
          }
        } catch (e) {
          console.error(`[Storage] Error purging session folder in ${bucket}:`, e);
        }
      }
    } catch (err) {
      console.error('[Storage] Failed to purge session storage folder:', err);
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    const { id, type, title } = deleteModal;
    setDeleteModal(null);

    if (type === 'session') {
      const sessionToDelete = sessions.find(s => s.id === id);
      if (!sessionToDelete) return;

      const sessionAudios = await db.getSessionAudios(id);
      const sessionMediaItems = await db.getSessionMedia(id);

      setSessions(prev => prev.filter(s => s.id !== id));
      const newEntries = { ...audioEntries };
      sessionAudios.forEach(a => delete newEntries[a.id]);
      setAudioEntries(newEntries);
      if (selectedSessionId === id) {
        setSessionMedia([]);
      }

      if (selectedSessionId === id) {
        navigateTo('list', null, sessionToDelete.groupId || null, 'replace');
      }

      const timeoutId = setTimeout(async () => {
        for (const audio of sessionAudios) await deleteAudioEntry(audio);
        for (const media of sessionMediaItems) await deleteMediaItem(media);
        await purgeSessionStorageFolder(id);
        await db.deleteSession(id);
      }, 5000);

      showToast(t('toast.sessionDeleted'), false, t('toast.undo'), () => handleUndo(id, type, sessionToDelete, sessionAudios, timeoutId));

    } else {
      const audioToDelete = audioEntries[id];
      if (!audioToDelete) return;

      setAudioEntries(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      const timeoutId = setTimeout(async () => {
        await deleteAudioEntry(audioToDelete);
      }, 5000);

      showToast(t('toast.audioDeleted'), false, t('toast.undo'), () => handleUndo(id, type, audioToDelete, null, timeoutId));
    }
  };

  const requestDeleteSession = (id: string, title: string) => setDeleteModal({ id, type: 'session', title });
  const requestDeleteAudio = (id: string, title: string) => setDeleteModal({ id, type: 'audio', title });

  const confirmReprocess = () => {
    if (!reprocessModal) return;
    const idToProcess = reprocessModal;
    setReprocessModal(null);
    handleProcessEntry(idToProcess);
  };

  // Folder Actions
  const handleCreateOrRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderModal || !folderModal.name.trim()) return;

    if (folderModal.type === 'create') {
      const newGroup: SessionGroup = {
        id: crypto.randomUUID(),
        name: folderModal.name.trim(),
        dateCreated: Date.now()
      };
      await db.saveGroup(newGroup);
      setGroups(prev => [...prev, newGroup]);
      showToast(t('toast.folderCreated', { name: newGroup.name }));
    } else if (folderModal.type === 'rename' && folderModal.id) {
      const group = groups.find(g => g.id === folderModal.id);
      if (group) {
        const updated = { ...group, name: folderModal.name.trim() };
        await db.saveGroup(updated);
        setGroups(prev => prev.map(g => g.id === folderModal.id ? updated : g));
        showToast(t('toast.folderRenamed', { name: updated.name }));
      }
    }
    setFolderModal(null);
  };

  const confirmDeleteFolder = async (deleteSessions: boolean) => {
    if (!deleteFolderModal) return;
    const { id, name } = deleteFolderModal;
    setDeleteFolderModal(null);

    await db.deleteGroup(id);
    setGroups(prev => prev.filter(g => g.id !== id));

    const allSessions = await db.getSessions();
    const updatedSessions = [...sessions];

    for (const session of allSessions) {
      if (session.groupId === id) {
        if (deleteSessions) {
          await db.deleteSession(session.id);
          const audios = await db.getSessionAudios(session.id);
          for (const a of audios) {
            await deleteAudioEntry(a);
          }
          const mediaItems = await db.getSessionMedia(session.id);
          for (const m of mediaItems) {
            await deleteMediaItem(m);
          }
          await purgeSessionStorageFolder(session.id);
          // Remove from local sessions state
          const idx = updatedSessions.findIndex(s => s.id === session.id);
          if (idx !== -1) updatedSessions.splice(idx, 1);
        } else {
          // Ungroup session
          const updated = { ...session, groupId: undefined };
          await db.saveSession(updated);
          const idx = updatedSessions.findIndex(s => s.id === session.id);
          if (idx !== -1) updatedSessions[idx] = updated;
        }
      }
    }
    setSessions(updatedSessions);
    if (selectedGroupId === id) {
      navigateTo('list', null, null, 'replace');
    }
    showToast(deleteSessions ? t('toast.folderAndSessionsDeleted', { name }) : t('toast.folderDeletedSessionsPreserved', { name }));
  };


  const handleGenerateShareLink = async (exportAsFile: boolean = false) => {
    if (!shareModal || !selectedSession) return;
    showSpinner(t('toast.generatingDoc'));
    try {
      const payload: any = {
        title: selectedSession.title,
        subtitle: selectedSession.subtitle,
        date: selectedSession.date,
      };
      if (shareModal.shareReport) {
        const report = await db.getSessionFinalReport(selectedSession.id);
        if (report && report.report) {
          const reportData: any = {};
          if (shareModal.shareStrictSummary && report.report.strictSummary) {
            reportData.strictSummary = report.report.strictSummary;
          }
          if (report.report.expandedInsights) {
            const insights: any = {};
            if (shareModal.shareDrills && report.report.expandedInsights.drills) {
              insights.drills = report.report.expandedInsights.drills;
            }
            if (shareModal.shareHomework && report.report.expandedInsights.homework) {
              insights.homework = report.report.expandedInsights.homework;
            }
            if (shareModal.shareTechnical && report.report.expandedInsights.technicalExpansion) {
              insights.technicalExpansion = report.report.expandedInsights.technicalExpansion;
            }
            if (shareModal.shareEmotional && report.report.expandedInsights.emotionalNotes) {
              insights.emotionalNotes = report.report.expandedInsights.emotionalNotes;
            }
            if (Object.keys(insights).length > 0) {
              reportData.expandedInsights = insights;
            }
          }
          if (Object.keys(reportData).length > 0) {
            payload.report = reportData;
            if (report.timestamp) {
              payload.reportTimestamp = report.timestamp;
            }
          }
        }
      }
      if (shareModal.shareNotes) {
        payload.notes = selectedSession.notes;
      }
      const audios = await db.getSessionAudios(selectedSession.id);
      audios.sort((a, b) => b.timestamp - a.timestamp);
      const audiosWithNames = audios.map((a, index) => {
        const defaultName = `Audio Entry ${audios.length - index}.webm`;
        return { ...a, exportFilename: a.filename || defaultName };
      });

      if (shareModal.shareTranscripts) {
        payload.transcripts = audiosWithNames.map(a => ({
          filename: a.exportFilename,
          timestamp: a.timestamp,
          transcript: a.transcript,
          strictSummary: a.strictSummary,
          expandedInsights: a.expandedInsights
        }));
      }

      if (shareModal.shareMedia) {
        const sessionMediaItems = await db.getSessionMedia(selectedSession.id);
        
        payload.mediaItems = sessionMediaItems.map(m => ({
          filename: m.filename,
          mimeType: m.mimeType,
          timestamp: m.timestamp
        }));
      }

      if (exportAsFile) {
        const zip = new JSZip();
        zip.file('session.json', JSON.stringify(payload, null, 2));
        
        for (const a of audiosWithNames) {
          if (a.audioBlob && shareModal.shareTranscripts) {
            zip.file(`media/${a.exportFilename}`, a.audioBlob);
          }
        }
        if (shareModal.shareMedia) {
          const sessionMediaItems = await db.getSessionMedia(selectedSession.id);
          for (const m of sessionMediaItems) {
            if (m.blob) {
              zip.file(`media/${m.filename}`, m.blob);
            } else if (m.fileHandle) {
              try {
              const perm = await m.fileHandle.queryPermission({ mode: 'read' });
              if (perm !== 'granted') {
                await m.fileHandle.requestPermission({ mode: 'read' });
              }
              const file = await m.fileHandle.getFile();
              zip.file(`media/${m.filename}`, file);
            } catch (e) {
              console.error("Failed to read fileHandle for export", m.filename, e);
              }
            }
          }
        }
        
        const content = await zip.generateAsync({ type: 'blob' });
        const fileName = `zoutty-session-${selectedSession.id.substring(0, 8)}.zoutty.zip`;
        let sharedViaApi = false;

        if (navigator.canShare) {
          const file = new File([content], fileName, { type: 'application/zip' });
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file]
              });
              sharedViaApi = true;
            } catch (error: any) {
              console.log('Share failed or cancelled', error);
              if (error.name === 'AbortError') {
                setShareModal(null);
                hideSpinner();
                return;
              }
            }
          }
        }

        if (!sharedViaApi) {
          saveAs(content, fileName);
          showToast(t('toast.fileExported'));
        } else {
          showToast(t('toast.shareSuccessful'));
        }
        
        const timestamp = Date.now();
        const updatedContent = {
          report: shareModal.shareReport,
          notes: shareModal.shareNotes,
          transcripts: shareModal.shareTranscripts,
          media: shareModal.shareMedia
        };
        await updateSession(selectedSession.id, { 
          shareMethod: 'file', 
          shareTimestamp: timestamp,
          sharedContent: updatedContent
        });

        setShareModal({
          ...shareModal,
          shareMethod: 'file',
          sharedContent: updatedContent,
          shareTimestamp: timestamp,
          viewState: 'active_file'
        });
        return;
      }

      const isUpdating = !!selectedSession.shareId;
      let shareId = selectedSession.shareId;
      if (!shareId) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        shareId = '';
        for (let i = 0; i < 6; i++) {
          shareId += characters.charAt(Math.floor(Math.random() * characters.length));
        }
      }
      const shareTimestamp = Date.now();

      const updatedContent = {
        report: shareModal.shareReport,
        notes: shareModal.shareNotes,
        transcripts: shareModal.shareTranscripts,
        media: shareModal.shareMedia
      };

      await updateSession(selectedSession.id, { 
          shareId, 
          shareTimestamp, 
          shareMethod: 'code',
          sharedContent: updatedContent
        });

      setShareModal(prev => prev ? { 
        ...prev, 
        generatedLink: shareId, 
        shareCode: shareId, 
        shareTimestamp,
        shareMethod: 'code',
        sharedContent: updatedContent,
        viewState: 'active_code' 
      } : null);
      showToast(isUpdating ? t('toast.shareCodeUpdated') : t('toast.shareCodeGenerated'));
    } catch (e) {
      console.error(e);
      showToast(t('toast.failedShareLink'), true);
    } finally {
      hideSpinner();
    }
  };
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    showSpinner(t('toast.importingSession'));
    try {
      const zip = await JSZip.loadAsync(file);
      const sessionJsonStr = await zip.file('session.json')?.async('string');
      if (!sessionJsonStr) throw new Error('Invalid .zoutty file: missing session.json');
      
      const sessionData = JSON.parse(sessionJsonStr);
      const parsedMediaFiles: any[] = [];
      
      if (sessionData.transcripts) {
        for (const t of sessionData.transcripts) {
          const fname = t.filename || 'undefined';
          const fileData = zip.file(`media/${fname}`);
          if (fileData) {
            const rawBlob = await fileData.async('blob');
            let mimeType = 'audio/webm';
            if (fname.endsWith('.m4a')) mimeType = 'audio/mp4';
            else if (fname.endsWith('.mp3')) mimeType = 'audio/mpeg';
            else if (fname.endsWith('.wav')) mimeType = 'audio/wav';
            else if (fname.endsWith('.caf')) mimeType = 'audio/x-caf';
            const blob = new Blob([rawBlob], { type: mimeType });
            parsedMediaFiles.push({ filename: fname, blob, isAudioEntry: true });
            if (!t.filename) {
              t.filename = fname;
            }
          }
        }
      }
      
      if (sessionData.mediaItems) {
        for (const m of sessionData.mediaItems) {
          const fileData = zip.file(`media/${m.filename}`);
          if (fileData) {
            const rawBlob = await fileData.async('blob');
            const blob = new Blob([rawBlob], { type: m.mimeType || 'image/jpeg' });
            parsedMediaFiles.push({ filename: m.filename, blob, isAudioEntry: false, mimeType: m.mimeType, timestamp: m.timestamp });
          }
        }
      }
      
      sessionData.parsedMediaFiles = parsedMediaFiles;
      setShowImportCodeModal(false);
      setImportCodeValue('');
      setImportPreview(sessionData);
    } catch (err: any) {
      console.error(err);
      showToast(t('toast.failedRetrieveShared'), true);
    } finally {
      hideSpinner();
      e.target.value = '';
    }
  };

  const handleImportSession = async () => {
    if (!importPreview) return;
    showSpinner(t('toast.importingSession'));
    try {
      const newSessionId = crypto.randomUUID();
      const newSession: Session = {
        id: newSessionId,
        title: importPreview.title + t('toast.sessionImportedSuffix'),
        subtitle: importPreview.subtitle || '',
        date: importPreview.date || Date.now(),
        notes: importPreview.notes || '',
        groupId: selectedGroupId || undefined,
        glossaryId: 'auto'
      };

      await db.saveSession(newSession);

      if (importPreview.report) {
        await db.saveFinalReport({
          id: crypto.randomUUID(),
          sessionId: newSessionId,
          report: importPreview.report,
          timestamp: importPreview.reportTimestamp || importPreview.date || Date.now()
        });
      }

      if (importPreview.transcripts && Array.isArray(importPreview.transcripts)) {
        for (const t of importPreview.transcripts) {
          const mediaFile = importPreview.parsedMediaFiles?.find((f: any) => f.isAudioEntry && f.filename === t.filename);
          let audioBlob = mediaFile ? mediaFile.blob : new Blob([], { type: 'audio/webm' });
          
          if (!mediaFile && t.audio_storage_path) {
            try {
              const { data } = supabase.storage.from('audios').getPublicUrl(t.audio_storage_path);
              const res = await fetch(data.publicUrl);
              if (res.ok) {
                audioBlob = await res.blob();
              }
            } catch (e) {
              console.error("Failed to fetch shared audio from Supabase", e);
            }
          }
          
          const newAudio: AudioEntry = {
            id: crypto.randomUUID(),
            sessionId: newSessionId,
            timestamp: t.timestamp || Date.now(),
            language: 'auto',
            transcript: t.transcript,
            strictSummary: t.strictSummary,
            expandedInsights: t.expandedInsights,
            type: 'recording',
            filename: t.filename,
            audioBlob
          };
          await db.saveAudioEntry(newAudio);
        }
      }

      if (importPreview.parsedMediaFiles) {
        for (const m of importPreview.parsedMediaFiles) {
          if (!m.isAudioEntry) {
            await db.saveMediaItem({
              id: crypto.randomUUID(),
              sessionId: newSessionId,
              timestamp: m.timestamp || Date.now(),
              mimeType: m.mimeType || 'image/jpeg',
              filename: m.filename,
              blob: m.blob,
              size: m.blob.size,
              storageMode: 'blob'
            });
          }
        }
      } else if (importPreview.mediaItems && Array.isArray(importPreview.mediaItems)) {
        for (const m of importPreview.mediaItems) {
          if (m.media_storage_path) {
            try {
              const { data } = supabase.storage.from('sessionMedia').getPublicUrl(m.media_storage_path);
              const res = await fetch(data.publicUrl);
              if (res.ok) {
                const blob = await res.blob();
                await db.saveMediaItem({
                  id: crypto.randomUUID(),
                  sessionId: newSessionId,
                  timestamp: m.timestamp || Date.now(),
                  mimeType: m.mimeType || 'image/jpeg',
                  filename: m.filename,
                  blob: blob,
                  size: blob.size,
                  storageMode: 'blob'
                });
              }
            } catch (e) {
              console.error("Failed to fetch shared media from Supabase", e);
            }
          }
        }
      }

      // Refresh state
      const loadedSessions = await db.getSessions();
      loadedSessions.sort((a, b) => b.date - a.date);
      setSessions(loadedSessions);

      const loadedAudios = await db.getAudioEntries();
      const audioRecord: Record<string, AudioEntry> = {};
      loadedAudios.forEach(a => audioRecord[a.id] = a);
      setAudioEntries(audioRecord);

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setImportPreview(null);
      showToast(t('toast.sessionImported'));
    } catch (e) {
      console.error(e);
      showToast(t('toast.failedImport'), true);
    } finally {
      hideSpinner();
    }
  };


  const handleProcessEntry = async (entryId: string) => {
    if (activeGlossaryIds.length === 0) {
      setShowMandatoryGlossaryModal(true);
      return;
    }
    const entry = audioEntries[entryId];
    if (!entry) return;

    const controller = new AbortController();

    const handleCancel = () => {
      controller.abort();
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
      hideSpinner();
      showToast(t('toast.processingCancelled'));
    };

    let blobToProcess = entry.audioBlob;
    if (!blobToProcess && entry.audio_storage_path) {
      showSpinner('Downloading audio for transcription...', handleCancel);
      try {
        const { data, error } = await supabase.storage.from('audios').download(entry.audio_storage_path);
        if (error) throw error;
        if (controller.signal.aborted) return;
        blobToProcess = data;
        // Save it back to IndexedDB so we don't have to download it again
        const updatedEntry = { ...entry, audioBlob: blobToProcess };
        await db.saveAudioEntry(updatedEntry);
        setAudioEntries(prev => ({ ...prev, [entryId]: updatedEntry }));
      } catch (e: any) {
        if (e.name === 'AbortError' || controller.signal.aborted) {
          console.log('Download aborted by user');
          return;
        }
        console.error("Failed to download audio blob:", e);
        showToast("Failed to download audio for transcription", true);
        hideSpinner();
        return;
      }
    }

    if (!blobToProcess) return;

    try {
      setProcessingIds(prev => new Set(prev).add(entryId));
      showSpinner(t('toast.processing', { filename: entry.filename || 'audio' }), handleCancel);

      const activeGlossary = glossaries.find(g => g.id === selectedSession?.glossaryId);
      const danceStyle = selectedSession?.glossaryId === 'auto'
        ? 'Auto'
        : (activeGlossary ? activeGlossary.name : 'Brazilian Zouk');
      const glossary = selectedSession?.glossaryId === 'auto' ? undefined : (activeGlossary ? activeGlossary.terms : undefined);

      // Call MCP Skill
      const result: any = await callZoukAudioProcessor({
        audio: blobToProcess,
        language: entry.language,
        sessionId: entry.sessionId,
        filename: entry.filename,
        glossary,
        danceStyle,
        signal: controller.signal
      });

      if (controller.signal.aborted) return;

      // Update entry with result, omitting transient API metadata
      const { status, processedAt, mockData, tier, usage, limits, ...cleanResult } = result || {};
      const finalizedEntry: AudioEntry = {
        ...entry,
        audioBlob: blobToProcess,
        ...cleanResult
      };

      console.log('[handleProcessEntry] Finalized entry structure - hasStrictSummary:', !!finalizedEntry.strictSummary, '| hasTranscript:', !!finalizedEntry.transcript);
      await db.saveAudioEntry(finalizedEntry);
      if (controller.signal.aborted) return;
      setAudioEntries(prev => ({ ...prev, [entryId]: finalizedEntry }));

      if (result.detectedStyle && selectedSession && selectedSession.glossaryId === 'auto') {
        const matched = glossaries.find(g => g.name.toLowerCase() === result.detectedStyle.toLowerCase());
        if (matched) {
          await updateSession(selectedSession.id, { glossaryId: matched.id });
          showToast(t('toast.aiDetectedStyle', { style: result.detectedStyle, glossary: matched.name }));
        } else {
          showToast(t('toast.aiDetectedStyleOnly', { style: result.detectedStyle }));
        }
      } else {
        showToast(entry.filename ? t('toast.processed', { filename: entry.filename }) : t('toast.audioProcessed'));
      }

      if (!getDevState().mockGemini) {
        fetchCloudProfileAndUsage();
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || controller.signal.aborted) {
        console.log('Processing aborted by user');
        return;
      }
      console.error('Processing failed:', error);
      const isQuota = error?.isQuota || error?.code === 'QUOTA_EXCEEDED' || (error?.message || '').toLowerCase().includes('quota') || (error?.message || '').includes('403') || (error?.message || '').toLowerCase().includes('limit');
      if (isQuota) {
        setShowQuotaModal({ isOpen: true, reason: 'clips' });
      } else {
        showToast(entry.filename ? t('toast.processingFailed', { filename: entry.filename }) : t('toast.audioProcessingFailed'), true);
      }
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
      hideSpinner();
    }
  };

  // `deleteAudioEntry` has moved to `requestDeleteAudio` & `confirmDelete`.

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, language: Language) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedSession) return;

    const fileList = Array.from(files);
    const exceededFiles: ExceededAudioFile[] = [];

    for (const file of fileList) {
      if (isVideoFile(file)) {
        await processAndSaveVideo(file, selectedSession.id, language);
      } else {
        const duration = await getMediaDuration(file);
        if (duration > TIER_LIMITS.MAX_CLIP_DURATION_SECONDS) {
          exceededFiles.push({ name: file.name, duration });
          continue;
        }
        await addAudioEntry(selectedSession.id, file, language, 'upload', file.name);
      }
    }

    if (exceededFiles.length > 0) {
      setShowDurationExceededModal({ isOpen: true, files: exceededFiles });
    }

    // reset input
    e.target.value = '';
  };

  const handleConsolidate = async () => {
    if (activeGlossaryIds.length === 0) {
      setShowMandatoryGlossaryModal(true);
      return;
    }
    if (!selectedSession) return;

    const controller = new AbortController();

    const handleCancel = () => {
      controller.abort();
      hideSpinner();
      showToast(t('toast.consolidationCancelled'));
    };

    showSpinner(t('toast.consolidating'), handleCancel);
    try {
      const sessionAudios = await db.getSessionAudios(selectedSession.id);
      if (controller.signal.aborted) return;

      if (sessionAudios.length === 0) {
        showToast(t('toast.noAudioData'), true);
        return;
      }

      // Prepare payload: send transcript if available, otherwise send base64 audio
      const audiosPayload = await Promise.all(
        sessionAudios.map(async (a) => {
          if (a.transcript) {
            return {
              audioId: a.id,
              transcript: a.transcript
            };
          }
          if (a.audioBlob && a.audioBlob instanceof Blob) {
            const b64 = await blobToBase64(a.audioBlob);
            return {
              audioId: a.id,
              base64: b64,
              language: a.language,
              mimeType: a.audioBlob.type || 'audio/webm'
            };
          }
          const fallbackText = Array.isArray(a.bulletPoints) && a.bulletPoints.length > 0
            ? a.bulletPoints.join('\n')
            : (Array.isArray(a.strictSummary) && a.strictSummary.length > 0 ? a.strictSummary.join('\n') : (a.filename || 'Recorded Audio Clip'));
          return {
            audioId: a.id,
            transcript: fallbackText
          };
        })
      );

      if (controller.signal.aborted) return;

      const activeGlossary = glossaries.find(g => g.id === selectedSession.glossaryId);
      const danceStyle = selectedSession.glossaryId === 'auto'
        ? 'Auto'
        : (activeGlossary ? activeGlossary.name : 'Brazilian Zouk');
      const glossary = selectedSession.glossaryId === 'auto' ? undefined : (activeGlossary ? activeGlossary.terms : undefined);

      const currentDev = getDevState();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (currentDev.mockGemini) {
        headers['x-dev-override'] = JSON.stringify(currentDev);
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          headers['Authorization'] = `Bearer ${sessionData.session.access_token}`;
        }
      } catch (_) {}

      const response = await fetch('/api/gemini/process-audio', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: selectedSession.id,
          audios: audiosPayload,
          glossary,
          danceStyle,
          availableGlossaries: glossaries.filter(g => activeGlossaryIds.includes(g.id)),
          appLanguage: uiLanguage,
          mockMode: currentDev.mockGemini
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        let errMessage = `Failed to process audio on backend. Status: ${response.status}`;
        let isQuota = response.status === 403;
        try {
          const errData = await response.json();
          if (errData.code === 'QUOTA_EXCEEDED' || response.status === 403) {
            setShowQuotaModal({ isOpen: true, reason: 'sessions' });
            return;
          }
          if (errData.error) errMessage = errData.error;
        } catch (_) {}
        const err: any = new Error(errMessage);
        err.isQuota = isQuota;
        throw err;
      }

      const { report: reportResult, tags: responseTags, newTranscripts, detectedStyle } = await response.json();
      if (controller.signal.aborted) return;

      if (currentDev.mockGemini) {
        const isFree = currentDev.tier === 'free';
        const isStudent = currentDev.tier === 'student';
        const isTeacher = currentDev.tier === 'teacher';
        const clipsCount = sessionAudios.length;

        // 1. Session deduction (1 consolidation = 1 session)
        const baseSessionLimit = isStudent ? TIER_LIMITS.student.monthly_sessions : isTeacher ? TIER_LIMITS.teacher.monthly_sessions : TIER_LIMITS.free.lifetime_sessions;
        const isBeyondBaseSessions = isFree
          ? (currentDev.lifetime_sessions || 0) >= baseSessionLimit
          : (currentDev.period_sessions || 0) >= baseSessionLimit;
        const hasTopupSessions = (currentDev.topup_extra_sessions || 0) > 0;

        let nextTopupSessions = currentDev.topup_extra_sessions || 0;
        let nextPeriodSessions = currentDev.period_sessions || 0;

        if (isBeyondBaseSessions && hasTopupSessions) {
          nextTopupSessions = Math.max(0, nextTopupSessions - 1);
        } else if (!isFree) {
          nextPeriodSessions = nextPeriodSessions + 1;
        }

        // 2. Clips deduction (clipsCount clips are processed during consolidation)
        let nextTopupClips = currentDev.topup_extra_clips || 0;
        let nextPeriodClips = currentDev.period_clips || 0;
        const baseClipLimit = isStudent ? TIER_LIMITS.student.monthly_clips : TIER_LIMITS.free.lifetime_clips;

        if (isFree) {
          const currentLifetimeClips = currentDev.lifetime_clips || 0;
          if (currentLifetimeClips >= baseClipLimit && (currentDev.topup_extra_clips || 0) > 0) {
            const spaceInBase = Math.max(0, baseClipLimit - currentLifetimeClips);
            const overflowClips = clipsCount - spaceInBase;
            nextTopupClips = Math.max(0, nextTopupClips - Math.max(0, overflowClips));
          }
        } else if (isStudent) {
          const currentPeriodClips = currentDev.period_clips || 0;
          const spaceInBase = Math.max(0, baseClipLimit - currentPeriodClips);

          if (clipsCount <= spaceInBase) {
            nextPeriodClips = currentPeriodClips + clipsCount;
          } else {
            nextPeriodClips = baseClipLimit;
            const overflowClips = clipsCount - spaceInBase;
            nextTopupClips = Math.max(0, nextTopupClips - overflowClips);
          }
        } else if (isTeacher) {
          nextPeriodClips = (currentDev.period_clips || 0) + clipsCount;
        }

        saveDevState({
          topup_extra_sessions: nextTopupSessions,
          topup_extra_clips: nextTopupClips,
          period_sessions: nextPeriodSessions,
          period_clips: nextPeriodClips,
          lifetime_sessions: (currentDev.lifetime_sessions || 0) + 1,
          lifetime_clips: (currentDev.lifetime_clips || 0) + clipsCount,
        });
      }

      console.log('[handleConsolidate] API response:', {
        hasReport: !!reportResult,
        newTranscriptsCount: newTranscripts ? Object.keys(newTranscripts).length : 0,
        detectedStyle
      });

      // Update individual entries if new transcripts were generated
      if (newTranscripts && Object.keys(newTranscripts).length > 0) {
        for (const [audioId, text] of Object.entries(newTranscripts)) {
          const entry = audioEntries[audioId];
          if (entry) {
            const updated = { ...entry, transcript: text as string };
            await db.saveAudioEntry(updated);
            setAudioEntries(prev => ({ ...prev, [audioId]: updated }));
          }
        }
      }

      if (controller.signal.aborted) return;

      await db.saveFinalReport({
        id: crypto.randomUUID(),
        sessionId: selectedSession.id,
        report: reportResult,
        timestamp: Date.now()
      });

      // Update session summary and glossary if detectedStyle matches a registered glossary
      const sessionChanges: Partial<Session> = { summary: reportResult };
      let gotStyleMatch = false;

      const extractedTags: string[] = Array.isArray(responseTags)
        ? responseTags
        : (Array.isArray(reportResult?.tags) ? reportResult.tags : []);

      if (extractedTags.length > 0) {
        const currentTags = selectedSession.tags || [];
        sessionChanges.tags = Array.from(new Set([...currentTags, ...extractedTags]));
      }

      if (detectedStyle && selectedSession.glossaryId === 'auto') {
        const matched = glossaries.find(g => g.name.toLowerCase() === detectedStyle.toLowerCase());
        if (matched) {
          sessionChanges.glossaryId = matched.id;
          gotStyleMatch = true;
        }
      }

      await updateSession(selectedSession.id, sessionChanges);

      if (gotStyleMatch) {
        const matched = glossaries.find(g => g.name.toLowerCase() === detectedStyle.toLowerCase());
        showToast(t('toast.aiDetectedStyle', { style: detectedStyle, glossary: matched!.name }));
      } else if (detectedStyle && selectedSession.glossaryId === 'auto') {
        showToast(t('toast.aiDetectedStyleOnly', { style: detectedStyle }));
      } else {
        showToast(t('toast.consolidated'));
      }

      if (!currentDev.mockGemini) {
        fetchCloudProfileAndUsage();
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || controller.signal.aborted) {
        console.log('Consolidation aborted by user');
        return;
      }
      console.error('Consolidation failed:', error);
      const isQuota = error?.isQuota || error?.code === 'QUOTA_EXCEEDED' || (error?.message || '').toLowerCase().includes('quota') || (error?.message || '').includes('403') || (error?.message || '').toLowerCase().includes('limit');
      if (isQuota) {
        setShowQuotaModal({ isOpen: true, reason: 'sessions' });
      } else {
        showToast(t('toast.consolidationFailed'), true);
      }
    } finally {
      hideSpinner();
    }
  };

  const ONBOARDING_STEPS: OnboardingStepConfig[] = [
    {
      stepIndex: 0,
      titleKey: 'onboarding.tourWelcomeTitle',
      descKey: 'onboarding.tourWelcomeSubtitle',
      isCenterModal: true,
    },
    {
      stepIndex: 1,
      targetSelector: '#onboarding-new-session-btn',
      titleKey: 'onboarding.step1Title',
      descKey: 'onboarding.step1Desc',
      tipKey: 'onboarding.step1Tip',
      preferredPlacement: 'bottom',
    },
    {
      stepIndex: 2,
      targetSelector: '#recordBtn',
      titleKey: 'onboarding.step2Title',
      descKey: 'onboarding.step2Desc',
      tipKey: 'onboarding.step2Tip',
      preferredPlacement: 'top',
    },
    {
      stepIndex: 3,
      targetSelector: '#consolidateBtn',
      titleKey: 'onboarding.step3Title',
      descKey: 'onboarding.step3Desc',
      tipKey: 'onboarding.step3Tip',
      preferredPlacement: 'top',
    },
    {
      stepIndex: 4,
      targetSelector: '#onboarding-export-btn',
      titleKey: 'onboarding.step4Title',
      descKey: 'onboarding.step4Desc',
      tipKey: 'onboarding.step4Tip',
      preferredPlacement: 'bottom',
    },
    {
      stepIndex: 5,
      targetSelector: '#onboarding-share-btn',
      titleKey: 'onboarding.step5Title',
      descKey: 'onboarding.step5Desc',
      tipKey: 'onboarding.step5Tip',
      preferredPlacement: 'bottom',
    },
    {
      stepIndex: 6,
      targetSelector: '#onboarding-settings-btn',
      titleKey: 'onboarding.step6Title',
      descKey: 'onboarding.step6Desc',
      tipKey: 'onboarding.step6Tip',
      preferredPlacement: 'bottom',
    },
    {
      stepIndex: 7,
      titleKey: 'onboarding.step7Title',
      descKey: 'onboarding.step7Desc',
      sandboxNoticeKey: 'onboarding.step7SandboxNotice',
      tipKey: 'onboarding.step7Tip',
      isCenterModal: true,
    },
  ];

  const handleTourNext = async () => {
    if (onboardingTourStep === null) return;

    if (onboardingTourStep === 0) {
      navigateTo('list', null, null, 'replace');
      setOnboardingTourStep(1);
    } else if (onboardingTourStep === 1) {
      const demoSessionId = "demo-session";
      const newSession = {
        id: demoSessionId,
        title: t('onboarding.demoSessionTitle'),
        subtitle: t('onboarding.demoSessionSubtitle'),
        date: Date.now(),
        glossaryId: 'auto',
        isDemo: true
      };
      await db.saveSession(newSession);
      const loadedSessions = await db.getSessions();
      loadedSessions.sort((a, b) => b.date - a.date);
      setSessions(loadedSessions);
      navigateTo('detail', demoSessionId, null, 'push');
      setOnboardingTourStep(2);
    } else if (onboardingTourStep === 2) {
      const mockAudio = {
        id: "demo-audio-1",
        sessionId: "demo-session",
        timestamp: Date.now(),
        language: uiLanguage,
        transcript: t('onboarding.demoAudioTranscript'),
        type: "recording" as const,
        filename: t('onboarding.demoAudioFilename'),
      };
      await db.saveAudioEntry(mockAudio);
      const loadedAudios = await db.getAudioEntries();
      const audioRecord: Record<string, any> = {};
      loadedAudios.forEach(a => audioRecord[a.id] = a);
      setAudioEntries(audioRecord);
      setOnboardingTourStep(3);
    } else if (onboardingTourStep === 3) {
      showSpinner(t('session.consolidatingWithAI'));
      setTimeout(async () => {
        const mockReport = {
          id: "demo-report-1",
          sessionId: "demo-session",
          timestamp: Date.now(),
          report: {
            strictSummary: [t('onboarding.demoReportStrict1'), t('onboarding.demoReportStrict2')],
            expandedInsights: {
              drills: [t('onboarding.demoReportDrill')],
              homework: [t('onboarding.demoReportHomework')],
              technicalExpansion: [],
              emotionalNotes: []
            }
          }
        };
        await db.saveFinalReport(mockReport);
        const demoSession = await db.getSession("demo-session");
        if (demoSession) {
          demoSession.summary = `${t('onboarding.demoReportStrict1')}\n${t('onboarding.demoReportStrict2')}`;
          await db.saveSession(demoSession);
        }
        const loadedSessions = await db.getSessions();
        loadedSessions.sort((a, b) => b.date - a.date);
        setSessions(loadedSessions);
        hideSpinner();
        setOnboardingTourStep(4);
      }, 700);
    } else if (onboardingTourStep === 4) {
      setOnboardingTourStep(5);
    } else if (onboardingTourStep === 5) {
      navigateTo('list', null, null, 'push');
      setOnboardingTourStep(6);
    } else if (onboardingTourStep === 6) {
      setOnboardingTourStep(7);
    } else if (onboardingTourStep === 7) {
      handleTourFinish();
    }
  };

  const handleTourPrev = async () => {
    if (onboardingTourStep === null || onboardingTourStep <= 0) return;

    if (onboardingTourStep === 1) {
      setOnboardingTourStep(0);
    } else if (onboardingTourStep === 2) {
      try {
        await db.deleteSession("demo-session");
        const loadedSessions = await db.getSessions();
        loadedSessions.sort((a, b) => b.date - a.date);
        setSessions(loadedSessions);
      } catch (e) {
        console.error(e);
      }
      navigateTo('list', null, null, 'push');
      setOnboardingTourStep(1);
    } else if (onboardingTourStep === 3) {
      try {
        await db.deleteAudioEntry("demo-audio-1");
        const loadedAudios = await db.getAudioEntries();
        const audioRecord: Record<string, any> = {};
        loadedAudios.forEach(a => audioRecord[a.id] = a);
        setAudioEntries(audioRecord);
      } catch (e) {
        console.error(e);
      }
      setOnboardingTourStep(2);
    } else if (onboardingTourStep === 4) {
      try {
        await db.deleteFinalReport("demo-report-1");
        const demoSession = await db.getSession("demo-session");
        if (demoSession) {
          delete demoSession.summary;
          await db.saveSession(demoSession);
        }
        const loadedSessions = await db.getSessions();
        loadedSessions.sort((a, b) => b.date - a.date);
        setSessions(loadedSessions);
      } catch (e) {
        console.error(e);
      }
      setOnboardingTourStep(3);
    } else if (onboardingTourStep === 5) {
      setOnboardingTourStep(4);
    } else if (onboardingTourStep === 6) {
      navigateTo('detail', 'demo-session', null, 'push');
      setOnboardingTourStep(5);
    } else if (onboardingTourStep === 7) {
      setOnboardingTourStep(6);
    }
  };

  const handleTourSkip = async () => {
    try {
      await db.deleteSession("demo-session");
      await db.deleteAudioEntry("demo-audio-1");
      await db.deleteFinalReport("demo-report-1");
      const loadedSessions = await db.getSessions();
      loadedSessions.sort((a, b) => b.date - a.date);
      setSessions(loadedSessions);
      const loadedAudios = await db.getAudioEntries();
      const audioRecord: Record<string, any> = {};
      loadedAudios.forEach(a => audioRecord[a.id] = a);
      setAudioEntries(audioRecord);
    } catch (e) {
      console.error('Error cleaning up demo session on skip:', e);
    }
    navigateTo('list', null, null, 'push');
    localStorage.setItem('zoutty_onboarding_completed', 'true');
    setHasCompletedOnboarding(true);
    setOnboardingTourStep(null);
    showToast(t('onboarding.tourSkippedToast'), false);
  };

  const handleTourFinish = () => {
    localStorage.setItem('zoutty_onboarding_completed', 'true');
    setHasCompletedOnboarding(true);
    setOnboardingTourStep(null);
    showToast(t('onboarding.tourFinishedToast'), false);
  };

  const handleStartOnboardingTour = () => {
    setShowAppSettings(false);
    navigateTo('list', null, null, 'push');
    setOnboardingTourStep(0);
  };

  const handleLogoAnimationComplete = () => {
    setLogoAnimationType(null);
  };

  // ------------------------------------------------------------------
  // Render Helpers
  // ------------------------------------------------------------------

  const folders = groups.filter(g => g.id !== 'root');
  const hasFolders = folders.length > 0;
  const hasOrphanSessions = sessions.some(s => !s.groupId);
  const showSessionsSection = selectedGroupId ? true : (!hasFolders || hasOrphanSessions);

  if (isInitializingAuth) {
    return <Spinner text="Connecting to cloud..." />;
  }

  if (!session && !isGuestMode) {
    return (
      <AuthScreen
        onSuccess={() => {
          setIsGuestMode(true);
          if (localStorage.getItem('zoutty_onboarding_completed') !== 'true') {
            setOnboardingTourStep(0);
          }
        }}
      />
    );
  }

  if (showSyncConflict) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center p-6 z-[200] text-zinc-100 font-sans">
        <div className="bg-zinc-900 border border-zinc-800 p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95 rounded-2xl shadow-2xl">
          <h3 className="text-xl flex items-center gap-2 text-white">
            <CloudUpload className="w-6 h-6 text-orange-500" />
            {t('modals.syncConflictTitle')}
          </h3>
          <p className="text-zinc-400 text-sm leading-relaxed">
            {t('modals.syncConflictMsg')}
          </p>
          <div className="flex flex-col gap-3 mt-6">
            <button onClick={() => finishInitialSync()} className="w-full px-5 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 transition-colors text-zinc-950 text-sm">{t('modals.syncMergeBtn')}</button>
            <button onClick={async () => {
              showSpinner('Replacing cloud data...');
              if (session?.user) {
                await syncEngine.wipeCloudData(session.user.id);
                // Force all local items to be pending sync so they get pushed back to the cloud
                const idb = await dbStart();
                const tables = ['sessions', 'audios', 'finalReports', 'sessionGroups', 'glossaries', 'sessionMedia'];
                for (const table of tables) {
                  const tx = idb.transaction(table, 'readwrite');
                  const store = tx.objectStore(table);
                  const req = store.getAll();
                  req.onsuccess = () => {
                    for (const item of (req.result as any[])) {
                      item.pending_sync = true;
                      store.put(item);
                    }
                  };
                }
              }
              hideSpinner();
              finishInitialSync();
            }} className="w-full px-5 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-100 text-sm border border-zinc-700/50">{t('modals.syncReplaceCloudBtn')}</button>
            <button onClick={async () => {
              showSpinner('Clearing local data...');
              await db.clearDatabase();
              hideSpinner();
              finishInitialSync();
            }} className="w-full px-5 py-3.5 rounded-xl bg-zinc-800 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-colors text-zinc-100 text-sm border border-zinc-700/50">{t('modals.syncUseCloudBtn')}</button>
          </div>
        </div>
      </div>
    );
  }

  if (isInitialSync) {
    return <Spinner text={t('sync.title')} />;
  }

  // --- Renderers ---
  return (
    <div className="min-h-screen font-sans selection:bg-brand/30">
      {logoAnimationType && (
        <LogoAnimation onComplete={handleLogoAnimationComplete} />
      )}
      {spinnerConfig && <Spinner text={spinnerConfig.text} onCancel={spinnerConfig.onCancel} />}
      {toastMessage && <Toast message={toastMessage.text} isError={toastMessage.isError} actionText={toastMessage.actionText} onAction={toastMessage.actionText ? toastMessage.onAction : undefined} duration={toastMessage.duration} onClose={() => setToastMessage(null)} />}

      <div className="sticky top-0 z-40 w-full flex flex-col">
        {/* Payment Failed / Past Due Banner */}
        {(devState.subscription_status === 'past_due' || devState.subscription_status === 'unpaid') && !paymentBannerDismissed && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-red-950/90 border-b border-red-500/40 backdrop-blur-md animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-red-100 text-sm leading-snug">
                  {t('billing.banner.paymentFailedTitle')}
                </p>
                <p className="text-red-200/80 text-xs mt-0.5 leading-snug">
                  {t('billing.banner.paymentFailedDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleOpenBillingPortal}
                disabled={isPortalLoading}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 min-h-[36px] flex items-center gap-1.5 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{t('billing.banner.updateBillingBtn')}</span>
              </button>
              <button
                onClick={() => setPaymentBannerDismissed(true)}
                className="p-2 rounded-lg hover:bg-red-900/60 text-red-300/70 hover:text-white transition-colors cursor-pointer"
                title={t('common.dismiss')}
                aria-label={t('common.dismiss')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Offline Banner */}
        {isOffline && !offlineBannerDismissed && (
          <div className="flex items-start gap-3 px-4 py-3 bg-zinc-800/90 border-b border-zinc-600/50 backdrop-blur-md animate-in slide-in-from-top duration-300">
            <span className="text-zinc-300 text-lg leading-none mt-0.5">📡</span>
            <div className="flex-1 min-w-0">
              <p className="text-zinc-100 text-sm leading-snug">{t('offline.bannerTitle')}</p>
              <p className="text-zinc-300/80 text-xs mt-0.5 leading-snug">{t('offline.bannerDesc')}</p>
            </div>
            <button
              onClick={() => setOfflineBannerDismissed(true)}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-zinc-700/50 hover:bg-zinc-600/50 text-zinc-300 text-xs transition-colors min-h-[36px]"
            >
              {t('offline.dismiss')}
            </button>
          </div>
        )}

        {/* Storage Full Banner */}
        {isStorageFull && !storageBannerDismissed && (
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/20 border-b border-amber-400/30 backdrop-blur-md animate-in slide-in-from-top duration-300">
            <span className="text-amber-300 text-lg leading-none mt-0.5">☁️</span>
            <div className="flex-1 min-w-0">
              <p className="text-amber-200 text-sm leading-snug">{t('storageFull.bannerTitle')}</p>
              <p className="text-amber-200/70 text-xs mt-0.5 leading-snug">{t('storageFull.bannerDesc')}</p>
            </div>
            <button
              onClick={() => setStorageBannerDismissed(true)}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 text-xs transition-colors min-h-[36px]"
            >
              {t('storageFull.dismiss')}
            </button>
          </div>
        )}
      </div>

      {/* Both Failed Modal */}
      {showBothFailed && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-6">
          <div className="glass p-8 max-w-sm w-full space-y-5 animate-in zoom-in-95">
            <div className="text-4xl text-center">😬</div>
            <h3 className="text-xl text-center">{t('storageFull.bothFailedTitle')}</h3>
            <p className="text-white/70 text-sm text-center leading-relaxed">{t('storageFull.bothFailed')}</p>
            <button
              onClick={() => setShowBothFailed(false)}
              className="w-full py-3 rounded-xl bg-brand hover:bg-brand/90 transition-colors text-white"
            >
              {t('storageFull.bothFailedBtn')}
            </button>
          </div>
        </div>
      )}

      {/* Delete Modal */}

      {deleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[60] p-6">
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl">{t('modals.confirmDeletion')}</h3>
            <p className="text-white/70">
              {deleteModal.type === 'session' ? t('modals.deleteSessionMsg', { title: deleteModal.title }) : t('modals.deleteAudioMsg', { title: deleteModal.title })}
            </p>
            <div className="flex gap-3 justify-end items-center mt-6">
              <button onClick={() => setDeleteModal(null)} className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]">{t('modals.cancelBtn')}</button>
              <button onClick={confirmDelete} className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30 text-white min-h-[44px]">{t('modals.deleteBtn')}</button>
            </div>
          </div>
        </div>
      )}

      {showSearchModal && (
        <SearchModal
          onClose={() => setShowSearchModal(false)}
          onConfirm={handleSearchConfirm}
          initialQuery={activeSearch?.query}
          initialFilters={activeSearch?.filters}
          glossaries={glossaries}
        />
      )}

      {/* Guest Lock Modal */}
      {showGuestLockModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-[110] animate-in fade-in duration-200">
          <div className="bg-[#111111] border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-xl mb-3 flex items-center gap-2">
              <Lock className="w-6 h-6 text-brand" />
              {t('appSettings.guestModalTitle')}
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              {t('appSettings.guestModalDesc')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowGuestLockModal(false)}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white text-sm cursor-pointer"
              >
                {t('auth.guestConfirmCancel')}
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('zoutty_guest_mode');
                  window.location.reload();
                }}
                className="px-5 py-3 rounded-xl bg-brand hover:bg-brand/90 transition-colors text-bg-dark text-sm shadow-lg shadow-brand/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4 rotate-180" />
                {t('appSettings.signInSignUpBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSearching && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[70]">
          <div className="glass p-6 rounded-2xl flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
            <span className="text-brand text-lg animate-pulse">Searching...</span>
          </div>
        </div>
      )}

      {/* Export Session Modal */}
      {showExportConfirm && selectedSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[60] p-6" onClick={() => setShowExportConfirm(false)}>
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl flex items-center gap-2">
              <Download className="w-5 h-5 text-brand" />
              {t('modals.confirmExport')}
            </h3>
            <p className="text-white/70 text-sm">
              {t('modals.exportMsg')}
            </p>

            <div className="space-y-3">
              <label className="text-xs text-white/40 uppercase tracking-wider">{t('modals.exportIncludeTranscriptsLabel')}</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={exportIncludeAudioTranscripts}
                  onClick={() => setExportIncludeAudioTranscripts(!exportIncludeAudioTranscripts)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${exportIncludeAudioTranscripts ? 'bg-brand' : 'bg-white/20'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${exportIncludeAudioTranscripts ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-white/80">
                  {t('modals.exportIncludeTranscripts')}
                </span>
              </div>
            </div>

            <div className="bg-brand/10 border border-brand/20 p-3 rounded-xl flex items-start gap-3 mt-4">
              <AlertTriangle className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <p className="text-xs text-brand/90 leading-relaxed">
                {t('modals.exportPdfInstructions')}
              </p>
            </div>

            <div className="flex gap-3 justify-end items-center mt-6">
              <button
                onClick={() => setShowExportConfirm(false)}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] cursor-pointer text-xs"
              >
                {t('modals.cancelBtn')}
              </button>
              <button
                onClick={async () => {
                  setShowExportConfirm(false);
                  if (!exportIncludeAudioTranscripts) {
                    document.body.classList.add('no-print-transcripts');
                  } else {
                    document.body.classList.remove('no-print-transcripts');
                  }
                  const dateStr = format(new Date(selectedSession.date), "yyyy-MM-dd");
                  let fileName = `Zoutty_${dateStr}`;
                  if (selectedSession.title) {
                    const safeTitle = selectedSession.title.replace(/[<>:"/\\|?*]/g, '_').trim();
                    fileName = `Zoutty_${safeTitle}`;
                  }
                  const originalTitle = document.title;
                  document.title = fileName;
                  setTimeout(() => {
                    const handleCleanup = () => {
                      document.title = originalTitle;
                      window.removeEventListener('afterprint', handleCleanup);
                      window.removeEventListener('focus', handleCleanup);
                    };
                    window.addEventListener('afterprint', handleCleanup);
                    window.addEventListener('focus', handleCleanup);
                    window.print();
                    setTimeout(() => { document.title = originalTitle; }, 10000);
                  }, 100);
                }}
                className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-light text-black transition-colors shadow-lg shadow-brand/20 min-h-[44px] cursor-pointer text-xs"
              >
                {t('modals.exportBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reprocess Modal */}
      {reprocessModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6">
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl flex items-center gap-2">
              <Zap className="w-6 h-6 text-brand" />
              {t('modals.confirmReprocess')}
            </h3>
            <p className="text-white/70">
              {t('modals.reprocessMsg')}
            </p>
            <div className="flex gap-3 justify-end items-center mt-6">
              <button onClick={() => setReprocessModal(null)} className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]">{t('modals.cancelBtn')}</button>
              <button onClick={confirmReprocess} className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand/90 transition-colors shadow-lg shadow-brand/30 text-black min-h-[44px]">{t('modals.reprocessBtn')}</button>
            </div>
          </div>
        </div>
      )}

      {/* App Settings Drawer */}
      {showAppSettings && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in duration-200"
            onClick={() => setShowAppSettings(false)}
          />
          {/* Drawer Panel */}
          <div
            className="fixed top-0 bottom-0 right-0 w-full sm:w-96 bg-[#1e1e22]/95 border-l border-white/10 backdrop-blur-md pt-6 pb-6 pl-6 pr-0 z-50 flex flex-col gap-6 shadow-2xl animate-in slide-in-from-right duration-300"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3 pr-6">
              <h3 className="text-lg text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-brand" />
                {t('appSettings.drawerTitle')}
              </h3>
              <button
                onClick={() => setShowAppSettings(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content - Container-reduced layout with collapsible sections */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5 pr-6">

              {/* 1. Language Section */}
              <div className="py-2 first:pt-0">
                <AppSettingsCollapsible
                  label={t('appSettings.languageSection')}
                  icon={<Globe className="w-4 h-4 text-brand" />}
                  defaultOpen={true}
                  badge={
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
                      {uiLanguage}
                    </span>
                  }
                >
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-white/60 leading-relaxed">
                      {t('appSettings.languageSectionDesc')}
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {Object.entries(UI_LANGUAGE_NAMES).map(([code, name]) => (
                        <button
                          key={code}
                          onClick={() => setUILanguage(code as any)}
                          className={`px-3.5 py-1.5 text-xs rounded-xl transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                            uiLanguage === code
                              ? 'bg-brand text-bg-dark font-medium shadow-[0_2px_8px_rgba(45,212,191,0.3)]'
                              : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5'
                          }`}
                        >
                          <span className="uppercase font-mono">{code}</span>
                          <span className={`text-[11px] ${uiLanguage === code ? 'text-bg-dark/80' : 'text-white/40'}`}>
                            ({name})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </AppSettingsCollapsible>
              </div>

              {/* 2. Account / Profile Section */}
              <div className="py-2">
                <AppSettingsCollapsible
                  label={t('appSettings.accountSection')}
                  icon={<LogOut className="w-4 h-4 text-orange-400" />}
                  defaultOpen={true}
                  badge={
                    isGuestMode ? (
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                        {t('guestModeBadge')}
                      </span>
                    ) : null
                  }
                >
                  <div className="space-y-3 pt-1">
                    {!isGuestMode && (
                      <p className="text-xs text-white/60 leading-relaxed text-orange-300/80">
                        {t('appSettings.logoutDesc')} <strong>{t('appSettings.logoutWarning')}</strong>
                      </p>
                    )}

                    {/* Clean User Profile Row */}
                    {(() => {
                      const resolvedDisplayName = devState.display_name || session?.user?.user_metadata?.display_name || session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || '';
                      return (
                        <div className="py-1 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 uppercase font-medium">
                            {resolvedDisplayName ? resolvedDisplayName[0].toUpperCase() : (session?.user?.email ? session.user.email[0].toUpperCase() : 'G')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">
                              {resolvedDisplayName || (session?.user?.email ? session.user.email : t('appSettings.guestUser'))}
                            </div>
                            <div className="text-xs text-white/40 truncate font-mono">
                              {session?.user?.email ? (resolvedDisplayName ? session.user.email : t('appSettings.authenticatedAccount')) : t('appSettings.localSandboxMode')}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Sub-collapsible: Edit Account (clean left accent line) */}
                    {!isGuestMode && session?.user && (
                      <div className="mt-2 pl-3 border-l-2 border-brand/30">
                        <AppSettingsCollapsible
                          label={t('appSettings.editAccountSection')}
                          icon={<Edit2 className="w-3.5 h-3.5 text-brand" />}
                          defaultOpen={false}
                        >
                          <div className="space-y-4 pt-1">
                            {/* Edit Display Name */}
                            <form onSubmit={handleSaveDisplayName} className="space-y-2">
                              <label className="text-xs text-white/70 block">
                                {t('appSettings.editDisplayNameLabel')}
                              </label>
                              <input
                                type="text"
                                value={editDisplayName}
                                onChange={(e) => setEditDisplayName(e.target.value)}
                                placeholder={t('appSettings.editDisplayNamePlaceholder')}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand/50 transition-all"
                              />
                              <button
                                type="submit"
                                disabled={
                                  isSavingDisplayName ||
                                  !editDisplayName.trim() ||
                                  editDisplayName.trim() === (devState.display_name || session?.user?.user_metadata?.display_name || session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || '')
                                }
                                className="w-full py-2 bg-brand text-bg-dark font-medium text-xs rounded-xl hover:bg-brand/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shadow-sm"
                              >
                                {isSavingDisplayName ? (
                                  <LoaderIcon className="w-4 h-4" />
                                ) : (
                                  t('appSettings.saveDisplayNameBtn')
                                )}
                              </button>
                            </form>

                            {/* Edit Password */}
                            <form onSubmit={handleUpdatePassword} className="space-y-2 border-t border-white/5 pt-3">
                              <label className="text-xs text-white/70 block">
                                {userHasPassword ? t('appSettings.changePasswordTitle') : t('appSettings.setPasswordTitle')}
                              </label>
                              {!userHasPassword && (
                                <p className="text-[11px] text-white/40 leading-relaxed">
                                  {t('appSettings.setPasswordDesc')}
                                </p>
                              )}

                              {userHasPassword && (
                                <div className="relative">
                                  <input
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder={t('appSettings.currentPasswordPlaceholder')}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 pr-10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand/50 transition-all"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                                  >
                                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                                </div>
                              )}

                              <div className="relative">
                                <input
                                  type={showNewPassword ? 'text' : 'password'}
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                  placeholder={t('appSettings.newPasswordPlaceholder')}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 pr-10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand/50 transition-all"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowNewPassword(!showNewPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                                >
                                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>

                              <div className="relative">
                                <input
                                  type={showConfirmNewPassword ? 'text' : 'password'}
                                  value={confirmNewPassword}
                                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                                  placeholder={t('appSettings.confirmNewPasswordPlaceholder')}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 pr-10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand/50 transition-all"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                                >
                                  {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>

                              <button
                                type="submit"
                                disabled={isUpdatingPassword || !newPassword || !confirmNewPassword}
                                className="w-full py-2 bg-white/10 hover:bg-white/15 text-white text-xs rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Lock className="w-3.5 h-3.5 text-white/70" />
                                {isUpdatingPassword ? t('common.processing') : (userHasPassword ? t('appSettings.updatePasswordBtn') : t('appSettings.setPasswordBtn'))}
                              </button>
                            </form>

                            {/* Delete Account */}
                            <div className="border-t border-white/5 pt-3 space-y-2">
                              <label className="text-xs text-red-400 block">
                                {t('appSettings.deleteAccountTitle')}
                              </label>
                              <p className="text-[11px] text-white/40 leading-relaxed">
                                {t('appSettings.deleteAccountDesc')}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteAccountConfirmInput('');
                                  setShowDeleteAccountModal(true);
                                }}
                                className="w-full flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all text-xs cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {t('appSettings.deleteAccountBtn')}
                              </button>
                            </div>
                          </div>
                        </AppSettingsCollapsible>
                      </div>
                    )}

                    {isGuestMode ? (
                      <button
                        onClick={() => {
                          localStorage.removeItem('zoutty_guest_mode');
                          setIsGuestMode(false);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl border border-orange-500/20 bg-orange-500/5 text-orange-400 hover:bg-orange-500/10 hover:text-white transition-all text-xs cursor-pointer"
                      >
                        <ArrowRight className="w-4 h-4" />
                        {t('appSettings.signInBtn')}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setShowLogoutConfirm(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl border border-orange-500/20 bg-orange-500/5 text-orange-400 hover:bg-orange-500/10 hover:text-white transition-all text-xs cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        {t('modals.logoutBtn')}
                      </button>
                    )}
                  </div>
                </AppSettingsCollapsible>
              </div>

              {/* 3. Plan & AI Quota Section */}
              <div className="py-2">
                {isGuestMode ? (
                  <AppSettingsCollapsible
                    label={t('appSettings.cloudAndAiSection')}
                    icon={<Cloud className="w-4 h-4 text-brand" />}
                    defaultOpen={true}
                  >
                    <div className="space-y-3 pt-1">
                      <p className="text-xs text-white/60 leading-relaxed">
                        {t('appSettings.guestCloudDesc')}
                      </p>
                      <button
                        onClick={() => {
                          localStorage.removeItem('zoutty_guest_mode');
                          window.location.reload();
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-brand hover:bg-brand/90 text-zinc-950 text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                      >
                        <LogOut className="w-3.5 h-3.5 rotate-180" />
                        <span>{t('appSettings.signInSignUpBtn')}</span>
                      </button>
                    </div>
                  </AppSettingsCollapsible>
                ) : (() => {
                  const currentTier: UserTier = (devState.tier === 'student' || devState.tier === 'teacher') ? devState.tier : 'free';
                  const isFree = currentTier === 'free';
                  const isStudent = currentTier === 'student';
                  const isTeacher = currentTier === 'teacher';

                  const isBoost = Boolean(
                    isFree &&
                    devState.referral_boost_active &&
                    devState.referral_boost_expires_at &&
                    new Date(devState.referral_boost_expires_at).getTime() > Date.now()
                  );
                  const topupSessions = !isFree ? (devState.topup_extra_sessions || 0) : 0;
                  const topupClips = !isFree ? (devState.topup_extra_clips || 0) : 0;

                  const boostSessions = isBoost ? (devState.referral_boost_extra_sessions || TIER_LIMITS.referral_boost.extra_sessions) : 0;
                  const boostClips = isBoost ? (devState.referral_boost_extra_clips || TIER_LIMITS.referral_boost.extra_clips) : 0;

                  const maxSessions = isFree
                    ? (TIER_LIMITS.free.lifetime_sessions + boostSessions)
                    : isStudent
                    ? TIER_LIMITS.student.monthly_sessions + topupSessions
                    : TIER_LIMITS.teacher.monthly_sessions + topupSessions;
                  const currentSessions = isFree ? (devState.lifetime_sessions || 0) : (devState.period_sessions || 0);

                  const maxClips = isFree
                    ? (TIER_LIMITS.free.lifetime_clips + boostClips)
                    : isStudent
                    ? TIER_LIMITS.student.monthly_clips + topupClips
                    : Infinity;
                  const currentClips = isFree ? (devState.lifetime_clips || 0) : (devState.period_clips || 0);
                  const nextResetDate = formatSafeDate(devState.current_period_end, uiLanguage);

                  const planBadge = (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase ${
                      isStudent
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : isTeacher
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : 'bg-white/10 text-white/70 border border-white/10'
                    }`}>
                      {isStudent ? t('billing.plans.studentName') : isTeacher ? t('billing.plans.teacherName') : t('billing.plans.freeName')}
                    </span>
                  );

                  return (
                    <AppSettingsCollapsible
                      label={t('billing.usage.sectionTitle')}
                      icon={<Sparkles className="w-4 h-4 text-brand" />}
                      defaultOpen={true}
                      badge={planBadge}
                    >
                      <div className="space-y-4 pt-1">
                        <p className="text-xs text-white/60 leading-relaxed">
                          {t('billing.usage.sectionDesc')}
                        </p>

                        {/* Inline Quota Progress - Container-reduced */}
                        <div className="space-y-3.5 py-2 border-y border-white/5">
                          {/* Sessions Usage */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-white/70 flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-brand" />
                                <span>{isFree ? t('billing.usage.lifetimeSessionsUsed', { used: currentSessions, total: maxSessions === Infinity ? t('billing.usage.infinite') : maxSessions }) : t('billing.usage.monthlySessionsUsed', { used: currentSessions, total: maxSessions === Infinity ? t('billing.usage.infinite') : maxSessions })}</span>
                              </span>
                              <span className="font-mono text-white/90">
                                {maxSessions === Infinity ? `${currentSessions} / ∞` : `${Math.min(currentSessions, maxSessions)} / ${maxSessions}`}
                              </span>
                            </div>
                            {maxSessions !== Infinity && (
                              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    currentSessions >= maxSessions ? 'bg-red-500' : 'bg-brand'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.round((currentSessions / maxSessions) * 100))}%` }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Audio Clips Usage */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-white/70 flex items-center gap-1.5">
                                <AudioLines className="w-3.5 h-3.5 text-brand" />
                                <span>
                                  {isTeacher || maxClips === Infinity
                                    ? t('billing.usage.unlimitedClips')
                                    : isFree
                                    ? t('billing.usage.lifetimeClipsUsed', { used: currentClips, total: maxClips })
                                    : t('billing.usage.monthlyClipsUsed', { used: currentClips, total: maxClips })}
                                </span>
                              </span>
                              <span className="font-mono text-white/90">
                                {maxClips === Infinity ? `${currentClips} / ∞` : `${Math.min(currentClips, maxClips)} / ${maxClips}`}
                              </span>
                            </div>
                            {maxClips !== Infinity && (
                              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    currentClips >= maxClips ? 'bg-red-500' : 'bg-brand'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.round((currentClips / maxClips) * 100))}%` }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Next Reset Date (Paid Users) */}
                          {!isFree && (
                            <div className="flex items-center justify-between text-[11px] text-white/50 pt-1">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-sky-400" />
                                {devState.cancel_at_period_end ? (
                                  <span>{t('billing.usage.cancelsOn', { date: nextResetDate })}</span>
                                ) : devState.pending_downgrade ? (
                                  <span>{t('billing.usage.downgradesOn', { date: nextResetDate })}</span>
                                ) : (
                                  <span>{t('billing.usage.resetDate', { date: nextResetDate })}</span>
                                )}
                              </span>
                            </div>
                          )}

                          {/* Active Referral Boost (Free Users) */}
                          {isFree && isBoost && (
                            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Gift className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                <span>{t('billing.usage.referralBoostActive', { sessions: devState.referral_boost_extra_sessions || 2, clips: devState.referral_boost_extra_clips || 10 })}</span>
                              </div>
                              {devState.referral_boost_expires_at && (
                                <span className="text-[10px] text-purple-300/80 font-normal">
                                  {t('billing.usage.boostExpiresOn', {
                                    date: new Date(devState.referral_boost_expires_at).toLocaleDateString(),
                                    days: Math.max(1, Math.ceil((new Date(devState.referral_boost_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
                                  })}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Banked Top-Up Allowance */}
                          {topupSessions > 0 && (
                            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>{t('billing.topup.badge', { count: topupSessions })}</span>
                              </div>
                              <span className="text-[10px] text-emerald-400/80">
                                {t('billing.topup.noExpireNote')}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Action Trigger Buttons */}
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                if (devState.tier === 'free') {
                                  setShowPricingModal(true);
                                } else {
                                  setManageSubscriptionInitialView('overview');
                                  setShowManageSubscriptionModal(true);
                                }
                              }}
                              className="flex-1 py-2.5 px-3 rounded-xl bg-brand hover:bg-brand/90 text-zinc-950 font-medium text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              <Zap className="w-3.5 h-3.5 fill-zinc-950" />
                              <span>{devState.tier === 'free' ? t('billing.limits.upgradeAction') : t('billing.plans.manageSubscription')}</span>
                            </button>
                            <button
                              onClick={() => {
                                setShowReferralModal(true);
                              }}
                              className="py-2.5 px-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              title={t('billing.referrals.title')}
                            >
                              <Gift className="w-3.5 h-3.5 text-purple-400" />
                              <span className="hidden sm:inline">{devState.tier === 'free' ? t('billing.limits.referralAction') : t('billing.referrals.title')}</span>
                            </button>
                          </div>

                          {/* Boost Button for Free Tier */}
                          {isFree && currentSessions >= maxSessions && (
                            <button
                              onClick={() => {
                                setShowReferralModal(true);
                              }}
                              className="w-full py-2.5 px-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                            >
                              <Gift className="w-4 h-4 text-purple-400" />
                              <span>{t('billing.limits.referralAction')}</span>
                            </button>
                          )}

                          {/* Top-Up Pack Button for paying users */}
                          {!isFree && (
                            <button
                              onClick={() => {
                                setShowTopupConfirmModal(true);
                              }}
                              className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                            >
                              <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                              <span>{t('billing.topup.buttonSettings')}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </AppSettingsCollapsible>
                  );
                })()}
              </div>

              {/* 4. My Dance Styles Section */}
              <div className="py-2">
                <AppSettingsCollapsible
                  label={t('glossary.myDanceStyles')}
                  icon={<BookOpen className="w-4 h-4 text-brand" />}
                  defaultOpen={true}
                  badge={
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                      {activeGlossaryIds.length}
                    </span>
                  }
                >
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-white/60 leading-relaxed">
                      {t('glossary.myDanceStylesDesc')}
                    </p>
                    <MultiSelectCombobox
                      selectedValues={activeGlossaryIds}
                      onChange={updateActiveGlossaryIds}
                      options={SYSTEM_GLOSSARIES.map(g => {
                        const tr = t(`danceStyles.${g.id}`);
                        return { value: g.id, label: (tr && !tr.startsWith('danceStyles.')) ? tr : g.name };
                      })}
                      placeholder={t('glossary.searchPlaceholder')}
                    />
                  </div>
                </AppSettingsCollapsible>
              </div>

              {/* 5. Offline Usage Guidance */}
              <div className="py-2">
                <AppSettingsCollapsible
                  label={t('appSettings.offlineGuideSection')}
                  icon={<Globe className="w-4 h-4 text-brand" />}
                  defaultOpen={false}
                >
                  <div className="space-y-2 pt-1 text-xs text-white/70 leading-relaxed pl-2 border-l-2 border-brand/30">
                    <p>• {t('appSettings.offlineGuide1')}</p>
                    <p>• {t('appSettings.offlineGuide2')}</p>
                    <p>• {t('appSettings.offlineGuide3')}</p>
                  </div>
                </AppSettingsCollapsible>
              </div>

              {/* 6. Developer & Onboarding Section */}
              <div className="py-2">
                <AppSettingsCollapsible
                  label={t('appSettings.devSection')}
                  icon={<SlidersHorizontal className="w-4 h-4 text-brand" />}
                  defaultOpen={false}
                >
                  <div className="space-y-2.5 pt-1">
                    <button
                      onClick={handleStartOnboardingTour}
                      className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-brand/20 bg-brand/5 text-brand hover:bg-brand/10 transition-all text-xs cursor-pointer"
                    >
                      <Compass className="w-4 h-4 text-brand" />
                      {t('onboarding.replayOnboardingBtn')}
                    </button>

                    <button
                      onClick={() => {
                        setShowAppSettings(false);
                        setShowReferralModal(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-purple-500/20 bg-purple-500/5 text-purple-300 hover:bg-purple-500/10 transition-all text-xs cursor-pointer"
                    >
                      <Gift className="w-4 h-4 text-purple-400" />
                      {t('billing.referrals.title')}
                    </button>
                  </div>
                </AppSettingsCollapsible>
              </div>

              {/* 7. Backup & Restore */}
              <div className="py-2">
                <AppSettingsCollapsible
                  label={t('appSettings.backupRestoreSection')}
                  icon={<Database className="w-4 h-4 text-brand" />}
                  defaultOpen={false}
                >
                  <div className="space-y-3 pt-1">
                    {/* Backup */}
                    <div className="space-y-2">
                      <p className="text-xs text-white/60 leading-relaxed">
                        {t('appSettings.backupDesc')}
                      </p>
                      <button
                        onClick={handleExportBackup}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-xs cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-brand" />
                        {t('appSettings.exportBackupBtn')}
                      </button>
                    </div>

                    {/* Restore */}
                    <div className="space-y-2 border-t border-white/5 pt-3">
                      <p className="text-xs text-white/60 leading-relaxed">
                        {t('appSettings.restoreDesc')}
                      </p>
                      <label className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-xs cursor-pointer">
                        <Upload className="w-4 h-4 text-brand" />
                        <span>{t('appSettings.restoreBackupBtn')}</span>
                        <input
                          type="file"
                          accept=".json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setRestoreBackupFile(file);
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </AppSettingsCollapsible>
              </div>

              {/* 8. Data & Privacy */}
              <div className="py-2 last:pb-0">
                <AppSettingsCollapsible
                  label={t('appSettings.dataPrivacySection')}
                  icon={<ShieldCheck className="w-4 h-4 text-brand" />}
                  defaultOpen={false}
                >
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-white/60 leading-relaxed">
                      {t('appSettings.resetDesc')}
                    </p>
                    <button
                      onClick={() => setShowResetConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 transition-all text-xs cursor-pointer"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      {t('appSettings.resetAppBtn')}
                    </button>
                  </div>
                </AppSettingsCollapsible>
              </div>

            </div>

            {/* Drawer Footer / Version Info */}
            <div className="border-t border-white/5 pt-4 text-center mt-auto pr-6">
              <button
                onClick={() => setShowVersionModal(true)}
                className="text-[10px] text-white/30 tracking-widest font-mono hover:text-white/60 transition-colors cursor-pointer"
              >
                ZOUTTY v{version}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Test Lab Modal */}
      <TestLabModal
        isOpen={showTestLabModal}
        onClose={() => setShowTestLabModal(false)}
        onStateApplied={(s) => {
          setDevState(s);
          if (!s.mockGemini) {
            fetchCloudProfileAndUsage();
          }
        }}
      />

      {/* Pricing / Plan Selection Modal */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        currentTier={devState.tier}
        onCheckoutSuccess={(targetTier) => {
          setShowPricingModal(false);
          const updated = saveDevState({
            tier: targetTier,
            subscription_status: 'active',
            period_sessions: 0,
            period_clips: 0,
          });
          setDevState(updated);
          setShowSubscriptionSuccessModal({ isOpen: true, tier: targetTier });
        }}
        onOpenReferrals={() => {
          setShowPricingModal(false);
          setShowReferralModal(true);
        }}
      />

      {/* Subscription Activation Celebration Modal */}
      <TopupConfirmModal
        isOpen={showTopupConfirmModal}
        onClose={() => !isTopupLoading && setShowTopupConfirmModal(false)}
        isLoading={isTopupLoading}
        onConfirm={async () => {
          setIsTopupLoading(true);
          const res = await startTopupCheckout();
          setIsTopupLoading(false);
          if (!res.success && res.error) {
            showToast(res.error, true);
          } else if (res.mock) {
            setShowTopupConfirmModal(false);
            const updated = saveDevState({
              ...devState,
              topup_extra_sessions: (devState.topup_extra_sessions || 0) + 5,
              topup_extra_clips: (devState.topup_extra_clips || 0) + 15,
            });
            setDevState(updated);
            setShowTopupSuccessModal(true);
          }
        }}
      />

      <SubscriptionSuccessModal
        isOpen={showSubscriptionSuccessModal.isOpen}
        onClose={() => setShowSubscriptionSuccessModal(prev => ({ ...prev, isOpen: false }))}
        tier={showSubscriptionSuccessModal.tier}
      />

      {/* Manage Subscription In-App Hub */}
      {(devState.tier === 'student' || devState.tier === 'teacher') && (
        <ManageSubscriptionModal
          isOpen={showManageSubscriptionModal}
          onClose={() => {
            setShowManageSubscriptionModal(false);
            setManageSubscriptionInitialView('overview');
          }}
          initialView={manageSubscriptionInitialView}
          currentTier={devState.tier as 'student' | 'teacher'}
          renewalDate={formatSafeDate(devState.current_period_end, uiLanguage)}
          pendingDowngrade={devState.pending_downgrade}
          isCanceling={devState.cancel_at_period_end}
          onReactivate={async () => {
            const result = await reactivateStripeSubscription();
            if (result.success) {
              setShowManageSubscriptionModal(false);
              const updated = saveDevState({
                ...devState,
                cancel_at_period_end: false,
              });
              setDevState(updated);
              showToast('Subscription reactivated successfully!');
            } else {
              showToast(result.error || 'Failed to reactivate subscription.', true);
            }
          }}
          onUpgrade={async () => {
            const result = await updateStripeSubscription('teacher');
            if (result.url) {
              window.location.href = result.url;
              return;
            }
            if (result.success) {
              setShowManageSubscriptionModal(false);
              const updated = saveDevState({
                tier: 'teacher',
                subscription_status: 'active',
                period_sessions: 0,
                period_clips: 0,
              });
              setDevState(updated);
              showToast('Upgraded to Teacher Plan successfully!');
            } else {
              showToast(result.error || t('billing.plans.checkoutError'), true);
            }
          }}
          onDowngrade={async () => {
            const result = await updateStripeSubscription('student');
            if (result.success) {
              setShowManageSubscriptionModal(false);
              // Do NOT downgrade tier immediately. It remains active until end of period.
              const updated = saveDevState({
                ...devState,
                pending_downgrade: 'student',
              });
              setDevState(updated);
              showToast('Downgrade scheduled! You will keep Teacher benefits until the end of your billing cycle.');
            } else {
              showToast(result.error || 'Failed to downgrade plan.', true);
            }
          }}
          isCancelingDowngrade={isCancelingDowngrade}
          onCancelDowngrade={async () => {
            setIsCancelingDowngrade(true);
            const result = await cancelStripeDowngrade();
            setIsCancelingDowngrade(false);
            if (result.success) {
              setShowManageSubscriptionModal(false);
              const updated = saveDevState({
                ...devState,
                pending_downgrade: null,
              });
              setDevState(updated);
              fetchCloudProfileAndUsage();
              showToast(t('billing.manage.cancelDowngradeSuccess'));
            } else {
              showToast(result.error || t('billing.manage.cancelDowngradeError'), true);
            }
          }}
          onCancelSubscription={async () => {
            const result = await cancelStripeSubscription();
            if (result.success) {
              setShowManageSubscriptionModal(false);
              const updated = saveDevState({
                cancel_at_period_end: true,
              });
              setDevState(updated);
              showToast('Subscription will cancel at the end of the billing period.');
            } else {
              showToast(result.error || 'Failed to cancel subscription.', true);
            }
          }}
          isPortalLoading={isPortalLoading}
          onOpenCustomerPortal={handleOpenBillingPortal}
        />
      )}

      {/* Quota Exceeded Interceptor Modal */}
      <QuotaExceededModal
        isOpen={showQuotaModal.isOpen}
        onClose={() => setShowQuotaModal(prev => ({ ...prev, isOpen: false }))}
        tier={devState.tier}
        subscriptionStatus={devState.subscription_status}
        reason={showQuotaModal.reason}
        canBoost={!devState.referral_boost_active}
        resetDate={devState.current_period_end}
        onStudentUpgradeClick={() => {
          setShowQuotaModal(prev => ({ ...prev, isOpen: false }));
          setManageSubscriptionInitialView('upgrade_confirm');
          setShowManageSubscriptionModal(true);
        }}
        onUpgradeClick={async (targetTier) => {
          setShowQuotaModal({ isOpen: false, reason: 'sessions' });
          if (!targetTier) {
            setShowPricingModal(true);
            return;
          }
          if (devState.tier === 'student' && targetTier === 'teacher') {
            setManageSubscriptionInitialView('upgrade_confirm');
            setShowManageSubscriptionModal(true);
            return;
          }
          
          const result = await startStripeCheckout(targetTier);
          if (result.mock) {
            const updated = saveDevState({
              tier: targetTier,
              subscription_status: 'active',
              period_sessions: 0,
              period_clips: 0,
            });
            setDevState(updated);
            setShowSubscriptionSuccessModal({ isOpen: true, tier: targetTier });
          } else if (!result.success) {
            showToast(result.error || t('billing.plans.checkoutError'), true);
          }
        }}
        onReferralClick={() => {
          setShowQuotaModal({ isOpen: false, reason: 'sessions' });
          setShowReferralModal(true);
        }}
        onOpenBillingPortal={handleOpenBillingPortal}
        onTopupClick={() => {
          setShowQuotaModal(prev => ({ ...prev, isOpen: false }));
          setShowTopupConfirmModal(true);
        }}
      />

      <NewSessionEntryModal
        isOpen={showNewSessionModal}
        onClose={() => setShowNewSessionModal(false)}
        onSelectOption={handleSelectEntryOption}
        onSelectFile={(option, file) => handleSelectEntryOption(option, file)}
      />

      <GlossaryModal
        isOpen={showGlossaryModal}
        onClose={() => setShowGlossaryModal(false)}
        glossary={null}
        onSave={async () => {}}
        onDelete={async () => {}}
      />

      <MandatoryGlossaryModal
        isOpen={showMandatoryGlossaryModal}
        onSave={(ids) => {
          updateActiveGlossaryIds(ids);
          setShowMandatoryGlossaryModal(false);
          if (!localStorage.getItem('zoutty_has_launched')) {
            setLogoAnimationType('onboarding');
            localStorage.setItem('zoutty_has_launched', 'true');
          }
        }}
      />

      {/* Audio Duration Exceeded Modal */}
      <AudioDurationExceededModal
        isOpen={showDurationExceededModal.isOpen}
        onClose={() => setShowDurationExceededModal({ isOpen: false, files: [] })}
        files={showDurationExceededModal.files}
      />

      {/* Recording Auto-Stopped Hard Cap Modal */}
      <RecordingAutoStoppedModal
        isOpen={showAutoStoppedModal}
        onClose={() => setShowAutoStoppedModal(false)}
      />

      {/* Referral Share Modal */}
      <ReferralModal
        isOpen={showReferralModal}
        onClose={() => setShowReferralModal(false)}
        tier={devState.tier}
        referralCode={userReferralCode}
        boostActive={devState.referral_boost_active || referralStats.boostActive}
        boostExpiresAt={devState.referral_boost_expires_at || referralStats.boostExpiresAt}
        boostExtraSessions={devState.referral_boost_extra_sessions || referralStats.boostExtraSessions}
        boostExtraClips={devState.referral_boost_extra_clips || referralStats.boostExtraClips}
        creditsBalance={devState.referral_credits_balance || referralStats.creditsBalance}
        totalReferrals={referralStats.totalReferrals}
        pendingRefundCount={referralStats.pendingRefundCount}
      />

      {/* Top-Up Purchase Success Modal */}
      <TopupSuccessModal
        isOpen={showTopupSuccessModal}
        onClose={() => setShowTopupSuccessModal(false)}
      />

      {/* Version & Changelog Modal */}
      {showVersionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[60] p-6" onClick={() => setShowVersionModal(false)}>
          <div className="glass p-8 max-w-md w-full animate-in zoom-in-95 relative max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="text-center shrink-0">
              <ZouttyIcon className="w-16 h-16 text-brand mx-auto" />
              <h3 className="text-xs uppercase tracking-[0.2em] text-brand font-bold font-logo mt-2">ZOUTTY</h3>
              <p className="inline-block mt-2 px-4 py-1 bg-white/10 text-white/70 font-mono rounded-full border border-white/20 text-sm tracking-widest">
                v{version}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6 mt-8 custom-scrollbar">
              <h4 className="text-sm text-white/50 uppercase tracking-wider mb-4 border-b border-white/10 pb-2">
                Changelog
              </h4>
              {changelog.map((entry, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-brand font-mono text-sm">v{entry.version}</span>
                    <span className="text-white/40 text-xs">{entry.date}</span>
                  </div>
                  <ul className="list-disc list-inside text-white/70 text-sm space-y-1">
                    {entry.changes.map((change, cIdx) => (
                      <li key={cIdx}>{change}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex justify-center mt-8 shrink-0 pt-6 border-t border-white/10">
              <button
                onClick={() => setShowVersionModal(false)}
                className="px-8 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]"
              >
                {t('modals.closeBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Restore Modal */}
      {restoreBackupFile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[60] p-6">
          <div className="glass p-6 sm:p-8 max-w-md w-full space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl flex items-center gap-2 text-white">
              <Upload className="w-6 h-6 text-brand" />
              {t('modals.restoreDbTitle')}
            </h3>
            <p className="text-white/70 text-sm leading-relaxed">
              {t('modals.restoreDbMsg')}
            </p>
            <div className="flex flex-wrap gap-3 justify-center items-center mt-6">
              <button onClick={() => setRestoreBackupFile(null)} className="px-4 sm:px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] text-sm">{t('modals.cancelBtn')}</button>
              <button onClick={() => executeImportBackup(restoreBackupFile, true)} className="px-4 sm:px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors shadow-lg text-white min-h-[44px] text-sm">{t('modals.restoreMergeBtn')}</button>
              <button onClick={() => executeImportBackup(restoreBackupFile, false)} className="px-4 sm:px-5 py-2.5 rounded-xl bg-brand hover:bg-brand/90 transition-colors shadow-lg shadow-brand/30 text-black min-h-[44px] text-sm">{t('modals.restoreReplaceBtn')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Reset Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[60] p-6">
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl flex items-center gap-2 text-red-400">
              <Trash2 className="w-6 h-6 text-red-500" />
              {t('modals.confirmReset')}
            </h3>
            <p className="text-white/70 text-sm leading-relaxed">
              {t('modals.resetMsg')}
              <br /><br />
              {t('modals.resetWarningMsg')}
            </p>
            <div className="flex gap-3 justify-end items-center mt-6">
              <button onClick={() => setShowResetConfirm(false)} className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] text-sm">{t('modals.cancelBtn')}</button>
              <button onClick={handleResetApp} className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30 text-white min-h-[44px] text-sm">{t('modals.resetEverythingBtn')}</button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[60] p-6">
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl flex items-center gap-2 text-orange-400">
              <LogOut className="w-6 h-6 text-orange-500" />
              {t('modals.confirmLogout')}
            </h3>
            <p className="text-white/70 text-sm leading-relaxed">
              {t('modals.logoutMsg')}
              <br /><br />
              {t('modals.logoutWarningMsg')}
            </p>
            <div className="flex gap-3 justify-end items-center mt-6">
              <button onClick={() => setShowLogoutConfirm(false)} className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] text-sm">{t('modals.cancelBtn')}</button>
              <button 
                onClick={async () => {
                  try {
                    await db.clearDatabase();
                    const savedLang = localStorage.getItem('zoutty_language');
                    localStorage.clear();
                    if (savedLang) {
                      localStorage.setItem('zoutty_language', savedLang);
                    }
                    resetDevState();
                    await supabase.auth.signOut();
                    window.location.reload();
                  } catch (e) {
                    console.error('Logout error', e);
                  }
                }} 
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/30 text-white min-h-[44px] text-sm"
              >
                {t('modals.logoutBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[60] p-6">
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95 border border-red-500/30">
            <h3 className="text-xl flex items-center gap-2 text-red-400">
              <Trash2 className="w-6 h-6 text-red-500" />
              {t('appSettings.deleteAccountModalTitle')}
            </h3>
            <p className="text-white/70 text-sm leading-relaxed">
              {t('appSettings.deleteAccountModalWarning')}
            </p>

            <div className="space-y-2">
              <label className="text-xs text-white/60 block">
                {t('appSettings.deleteAccountConfirmPrompt')}
              </label>
              <input
                type="text"
                autoFocus
                value={deleteAccountConfirmInput}
                onChange={(e) => setDeleteAccountConfirmInput(e.target.value)}
                placeholder={t('appSettings.deleteAccountConfirmPlaceholder')}
                className="w-full bg-black/40 border border-white/15 focus:border-red-500/60 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all font-mono uppercase"
              />
            </div>

            <div className="flex gap-3 justify-end items-center mt-6">
              <button
                type="button"
                onClick={() => setShowDeleteAccountModal(false)}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] text-sm text-white"
              >
                {t('modals.cancelBtn')}
              </button>
              <button
                type="button"
                disabled={
                  isDeletingAccount ||
                  (deleteAccountConfirmInput.trim().toUpperCase() !== 'DELETE' &&
                   deleteAccountConfirmInput.trim().toUpperCase() !== 'BORRAR')
                }
                onClick={handleDeleteAccount}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30 text-white min-h-[44px] text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('appSettings.deleteAccountConfirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Create/Rename Modal */}
      {folderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6">
          <form onSubmit={handleCreateOrRenameFolder} className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl flex items-center gap-2">
              <Folder className="w-6 h-6 text-brand" />
              {folderModal.type === 'create' ? t('modals.createFolder') : t('modals.renameFolder')}
            </h3>
            <div className="space-y-2">
              <label className="text-xs text-white/50 uppercase tracking-wider">{t('modals.folderNameLabel')}</label>
              <input
                autoFocus
                type="text"
                placeholder={t('modals.folderNamePlaceholder')}
                value={folderModal.name}
                onChange={(e) => setFolderModal({ ...folderModal, name: e.target.value })}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-brand/50 transition-colors"
                required
              />
            </div>
            <div className="flex gap-3 justify-end items-center">
              <button type="button" onClick={() => setFolderModal(null)} className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]">{t('modals.cancelBtn')}</button>
              <button type="submit" className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand/90 text-bg-dark transition-colors shadow-lg shadow-brand/20 min-h-[44px]">{t('modals.saveBtn')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Folder Modal */}
      {deleteFolderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6">
          <div className="glass p-8 max-w-md w-full space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl text-red-400 flex items-center gap-2">
              <Trash2 className="w-6 h-6 shrink-0" />
              {t('modals.deleteFolder')}
            </h3>
            <p className="text-white/80">
              {t('modals.deleteFolderMsg', { name: deleteFolderModal.name })}
            </p>

            {/* Custom confirm option checkbox */}
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl">
              <CustomCheckbox
                id="deleteSessionsCheckbox"
                checked={deleteFolderAlsoSessions}
                onChange={setDeleteFolderAlsoSessions}
                label={
                  <div className="text-sm text-red-300 cursor-pointer select-none">
                    {t('modals.deleteFolderAlsoSessions')}
                    <span className="block text-xs font-normal text-white/50 mt-1 font-sans">
                      {t('modals.deleteFolderSessionsNote')}
                    </span>
                  </div>
                }
              />
            </div>

            <div className="flex gap-3 justify-end items-center mt-6">
              <button
                onClick={() => {
                  setDeleteFolderModal(null);
                  setDeleteFolderAlsoSessions(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]"
              >
                {t('modals.cancelBtn')}
              </button>
              <button
                onClick={() => {
                  confirmDeleteFolder(deleteFolderAlsoSessions);
                  setDeleteFolderAlsoSessions(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30 text-white min-h-[44px]"
              >
                {t('modals.deleteFolderBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Session Modal */}
      {moveSessionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6">
          <div className="glass p-6 max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-lg flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-brand" />
                {t('modals.moveSessionTitle')}
              </h3>
              <button
                onClick={() => setMoveSessionModal(null)}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors text-white/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-white/60 font-sans">
              {t('modals.moveSessionDesc')}
            </p>

            <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
              {/* Root (Ungrouped) Option */}
              <button
                onClick={async () => {
                  await updateSession(moveSessionModal.sessionId, { groupId: undefined });
                  showToast(t('toast.sessionMovedToRoot'));
                  setMoveSessionModal(null);
                }}
                className={`w-full p-3.5 rounded-xl border flex items-center gap-3 transition-all text-left ${!moveSessionModal.currentGroupId
                  ? 'bg-brand/20 border-brand text-brand'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                  }`}
              >
                <Folder className="w-5 h-5 opacity-60 text-brand" />
                <div className="flex-1 text-sm">{t('modals.moveSessionRoot')}</div>
                {!moveSessionModal.currentGroupId && <CheckCircle2 className="w-4 h-4 text-brand" />}
              </button>

              {/* Folders List */}
              {groups.filter(g => g.id !== 'root').map(group => (
                <button
                  key={group.id}
                  onClick={async () => {
                    await updateSession(moveSessionModal.sessionId, { groupId: group.id });
                    showToast(t('toast.sessionMovedToFolder', { name: group.name }));
                    setMoveSessionModal(null);
                  }}
                  className={`w-full p-3.5 rounded-xl border flex items-center gap-3 transition-all text-left ${moveSessionModal.currentGroupId === group.id
                    ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                    }`}
                >
                  <Folder className="w-5 h-5 opacity-60 text-blue-400" />
                  <div className="flex-1 text-sm truncate">{group.name}</div>
                  {moveSessionModal.currentGroupId === group.id && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setMoveSessionModal(null)}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-sm min-h-[38px]"
              >
                {t('modals.cancelBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Session Modal */}
      {shareModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto">
          <div
            className="glass border border-white/10 p-6 max-w-md w-full rounded-2xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shrink-0 shadow-inner">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg text-white">
                    {t('modals.shareSession')}
                  </h3>
                  <p className="text-xs text-white/50">
                    {selectedSession.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShareModal(null)}
                className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors cursor-pointer"
                title={t('modals.closeBtn')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {shareModal.viewState === 'checklist' ? (
              <div className="flex flex-col flex-1 overflow-hidden">
                <p className="text-white/60 text-xs mb-3 shrink-0">
                  {t('modals.shareSelectInfo')}
                </p>

                {/* Content Checklist - Clean flattened list with dividers */}
                <div className="overflow-y-auto custom-scrollbar pr-1 divide-y divide-white/5 flex-1">
                  {/* Consolidated Report Option */}
                  <div className="py-3 first:pt-0">
                    <CustomSwitch
                      disabled={!shareModal.availableReport}
                      checked={shareModal.shareReport}
                      onChange={(checked) => {
                        setShareModal({
                          ...shareModal,
                          shareReport: checked,
                          shareStrictSummary: checked ? shareModal.availableStrictSummary : false,
                          shareDrills: checked ? shareModal.availableDrills : false,
                          shareHomework: checked ? shareModal.availableHomework : false,
                          shareTechnical: checked ? shareModal.availableTechnical : false,
                          shareEmotional: checked ? shareModal.availableEmotional : false,
                        });
                      }}
                      label={
                        <span className={`text-sm ${!shareModal.availableReport ? 'text-white/40' : 'text-white'}`}>
                          {t('modals.shareConsolidatedReport')} {!shareModal.availableReport && t('modals.shareReportLocked')}
                        </span>
                      }
                      className="px-1"
                    />

                    {/* Sub-sections with clean left accent line */}
                    {shareModal.availableReport && shareModal.shareReport && (
                      <div className="mt-2.5 ml-1 pl-3.5 border-l-2 border-brand/30 space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center gap-3 pt-0.5 pb-1">
                          <button
                            type="button"
                            onClick={() => setShareModal({
                              ...shareModal,
                              shareStrictSummary: shareModal.availableStrictSummary,
                              shareDrills: shareModal.availableDrills,
                              shareHomework: shareModal.availableHomework,
                              shareTechnical: shareModal.availableTechnical,
                              shareEmotional: shareModal.availableEmotional
                            })}
                            className="text-[10px] text-brand hover:text-brand-light transition-colors uppercase tracking-wider cursor-pointer"
                          >
                            {t('modals.shareSelectAll')}
                          </button>
                          <span className="text-white/20 text-xs">•</span>
                          <button
                            type="button"
                            onClick={() => setShareModal({
                              ...shareModal,
                              shareStrictSummary: false,
                              shareDrills: false,
                              shareHomework: false,
                              shareTechnical: false,
                              shareEmotional: false
                            })}
                            className="text-[10px] text-white/40 hover:text-white/70 transition-colors uppercase tracking-wider cursor-pointer"
                          >
                            {t('modals.shareDeselectAll')}
                          </button>
                        </div>

                        <CustomCheckbox
                          disabled={!shareModal.availableStrictSummary}
                          checked={shareModal.shareStrictSummary}
                          onChange={(checked) => setShareModal({ ...shareModal, shareStrictSummary: checked })}
                          label={t('modals.shareStrictSummary') + (!shareModal.availableStrictSummary ? ' ' + t('modals.shareNotAvailable') : '')}
                          className="py-0.5"
                        />
                        <CustomCheckbox
                          disabled={!shareModal.availableDrills}
                          checked={shareModal.shareDrills}
                          onChange={(checked) => setShareModal({ ...shareModal, shareDrills: checked })}
                          label={t('modals.shareDrills') + (!shareModal.availableDrills ? ' ' + t('modals.shareNotAvailable') : '')}
                          className="py-0.5"
                        />
                        <CustomCheckbox
                          disabled={!shareModal.availableHomework}
                          checked={shareModal.shareHomework}
                          onChange={(checked) => setShareModal({ ...shareModal, shareHomework: checked })}
                          label={t('modals.shareHomework') + (!shareModal.availableHomework ? ' ' + t('modals.shareNotAvailable') : '')}
                          className="py-0.5"
                        />
                        <CustomCheckbox
                          disabled={!shareModal.availableTechnical}
                          checked={shareModal.shareTechnical}
                          onChange={(checked) => setShareModal({ ...shareModal, shareTechnical: checked })}
                          label={t('modals.shareTechnical') + (!shareModal.availableTechnical ? ' ' + t('modals.shareNotAvailable') : '')}
                          className="py-0.5"
                        />
                        <CustomCheckbox
                          disabled={!shareModal.availableEmotional}
                          checked={shareModal.shareEmotional}
                          onChange={(checked) => setShareModal({ ...shareModal, shareEmotional: checked })}
                          label={t('modals.shareEmotional') + (!shareModal.availableEmotional ? ' ' + t('modals.shareNotAvailable') : '')}
                          className="py-0.5"
                        />
                      </div>
                    )}
                  </div>

                  {/* Notes Option */}
                  <div className="py-3">
                    <CustomSwitch
                      disabled={!shareModal.availableNotes}
                      checked={shareModal.shareNotes}
                      onChange={(checked) => setShareModal({ ...shareModal, shareNotes: checked })}
                      label={
                        <span className={`text-sm ${!shareModal.availableNotes ? 'text-white/40' : 'text-white'}`}>
                          {t('modals.shareNotes')} {!shareModal.availableNotes && t('modals.shareNoNotes')}
                        </span>
                      }
                      className="px-1"
                    />
                  </div>

                  {/* Transcripts Option */}
                  <div className="py-3">
                    <CustomSwitch
                      disabled={!shareModal.availableTranscripts}
                      checked={shareModal.shareTranscripts}
                      onChange={(checked) => setShareModal({ ...shareModal, shareTranscripts: checked })}
                      label={
                        <span className={`text-sm ${!shareModal.availableTranscripts ? 'text-white/40' : 'text-white'}`}>
                          {t('modals.shareTranscripts')} {!shareModal.availableTranscripts && t('modals.shareNoTranscripts')}
                        </span>
                      }
                      className="px-1"
                    />
                  </div>

                  {/* Media Option */}
                  <div className="py-3 last:pb-0">
                    <CustomSwitch
                      disabled={!shareModal.availableMedia}
                      checked={shareModal.shareMedia}
                      onChange={(checked) => setShareModal({ ...shareModal, shareMedia: checked })}
                      label={
                        <span className={`text-sm ${!shareModal.availableMedia ? 'text-white/40' : 'text-white'}`}>
                          {t('modals.shareMedia')} {!shareModal.availableMedia && <span className="font-normal text-xs opacity-70">({t('modals.shareNoMedia')})</span>}
                        </span>
                      }
                      className="px-1"
                    />
                    {shareModal.shareMedia && shareModal.hasHeavyMedia && (
                      <p className="px-1 mt-2 text-xs text-brand/90 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('modals.shareMediaWarning')}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 mt-2 border-t border-white/10 space-y-3 shrink-0">
                  <button
                    onClick={() => handleGenerateShareLink(false)}
                    disabled={!shareModal.shareReport && !shareModal.shareNotes && !shareModal.shareTranscripts && !shareModal.shareMedia}
                    className="w-full py-3 rounded-xl bg-brand text-bg-dark font-medium hover:bg-brand/90 disabled:opacity-20 transition-all shadow-[0_0_15px_rgba(45,212,191,0.2)] min-h-[44px] cursor-pointer"
                  >
                    {selectedSession.shareId ? t('modals.updateShareLink') : t('modals.generateShareLink')}
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="h-px bg-white/10 flex-1" />
                    <span className="text-white/30 text-[10px] uppercase tracking-widest">{t('modals.or')}</span>
                    <div className="h-px bg-white/10 flex-1" />
                  </div>

                  <div>
                    <button
                      onClick={() => handleGenerateShareLink(true)}
                      disabled={!shareModal.shareReport && !shareModal.shareNotes && !shareModal.shareTranscripts && !shareModal.shareMedia}
                      className="w-full py-2.5 rounded-xl border border-white/15 hover:bg-white/5 disabled:opacity-20 text-white/80 hover:text-white transition-colors min-h-[40px] text-sm cursor-pointer"
                    >
                      {t('modals.exportFileBtn')}
                    </button>
                    <p className="text-center text-[11px] text-white/40 mt-1.5">{t('modals.exportFileTooltip')}</p>
                  </div>
                </div>
              </div>
            ) : shareModal.viewState === 'active_code' ? (
              <div className="flex flex-col flex-1 space-y-4">
                <p className="text-white/70 text-xs leading-relaxed">
                  {t('modals.previouslySharedCodeText', { date: shareModal.shareTimestamp ? new Date(shareModal.shareTimestamp).toLocaleDateString() : '' })}
                </p>

                {/* Clean included items row */}
                <div className="flex flex-wrap gap-1.5">
                  {shareModal.sharedContent?.report && (
                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-brand/10 border border-brand/20 text-brand-light">
                      {t('modals.shareConsolidatedReport')}
                    </span>
                  )}
                  {shareModal.sharedContent?.notes && (
                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-brand/10 border border-brand/20 text-brand-light">
                      {t('modals.shareNotes')}
                    </span>
                  )}
                  {shareModal.sharedContent?.transcripts && (
                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-brand/10 border border-brand/20 text-brand-light">
                      {t('modals.shareTranscripts')}
                    </span>
                  )}
                  {shareModal.sharedContent?.media && (
                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-brand/10 border border-brand/20 text-brand-light">
                      {t('modals.shareMedia')}
                    </span>
                  )}
                </div>

                {/* Prominent Code Box */}
                <div className="py-4 border-y border-white/10 flex flex-col items-center justify-center gap-2">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest">{t('modals.shareCodeLabel')}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-brand text-3xl sm:text-4xl font-mono tracking-widest select-all font-semibold drop-shadow-[0_0_12px_rgba(45,212,191,0.3)]">
                      {shareModal.shareCode}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(shareModal.shareCode || '');
                        showToast(t('toast.codeCopied'));
                      }}
                      className="p-2.5 hover:bg-white/10 active:scale-95 rounded-xl text-brand hover:text-white transition-all cursor-pointer"
                      title="Copy code"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <p className="text-white/40 text-[11px] text-center italic">
                  {shareModal.shareTimestamp
                    ? t('modals.shareLinkExpiryCountdown', { days: Math.max(1, 30 - Math.floor((Date.now() - shareModal.shareTimestamp) / (1000 * 60 * 60 * 24))) })
                    : t('modals.shareLinkExpiry')}
                </p>

                <button
                  onClick={async () => {
                    const shareCode = shareModal.shareCode || '';
                    const shareMessage = t('modals.shareMessageTemplate', { code: shareCode });

                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: t('modals.shareSession'),
                          text: shareMessage,
                        });
                        showToast(t('toast.shareSuccessful'));
                      } catch (err) {
                        console.log('Share sheet dismissed or failed, falling back to copy:', err);
                        navigator.clipboard.writeText(shareMessage);
                        showToast(t('toast.codeCopied'));
                      }
                    } else {
                      navigator.clipboard.writeText(shareMessage);
                      showToast(t('toast.codeCopied'));
                    }
                  }}
                  className="w-full py-3 bg-brand text-bg-dark font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-brand/90 transition-all active:scale-[0.98] shadow-[0_0_15px_rgba(45,212,191,0.2)] min-h-[44px] cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{t('modals.shareCodeBtn')}</span>
                </button>

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => setShareModal({ ...shareModal, viewState: 'checklist' })}
                    className="text-xs text-white/60 hover:text-white transition-colors cursor-pointer py-1"
                  >
                    {t('modals.updateExportSettingsBtn')}
                  </button>
                  <button
                    onClick={() => setShareModal(null)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-xs transition-colors cursor-pointer"
                  >
                    {t('modals.closeBtn')}
                  </button>
                </div>
              </div>
            ) : shareModal.viewState === 'active_file' ? (
              <div className="flex flex-col flex-1 space-y-4">
                <p className="text-white/70 text-xs leading-relaxed">
                  {t('modals.previouslyExportedText', { date: shareModal.shareTimestamp ? new Date(shareModal.shareTimestamp).toLocaleDateString() : '' })}
                </p>

                {/* Clean included items row */}
                <div className="flex flex-wrap gap-1.5 py-2 border-y border-white/10">
                  {shareModal.sharedContent?.report && (
                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-brand/10 border border-brand/20 text-brand-light">
                      {t('modals.shareConsolidatedReport')}
                    </span>
                  )}
                  {shareModal.sharedContent?.notes && (
                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-brand/10 border border-brand/20 text-brand-light">
                      {t('modals.shareNotes')}
                    </span>
                  )}
                  {shareModal.sharedContent?.transcripts && (
                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-brand/10 border border-brand/20 text-brand-light">
                      {t('modals.shareTranscripts')}
                    </span>
                  )}
                  {shareModal.sharedContent?.media && (
                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-brand/10 border border-brand/20 text-brand-light">
                      {t('modals.shareMedia')}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleGenerateShareLink(true)}
                  className="w-full py-3 bg-brand text-bg-dark font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-brand/90 transition-all active:scale-[0.98] shadow-[0_0_15px_rgba(45,212,191,0.2)] min-h-[44px] cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('modals.exportFileAgainBtn')}</span>
                </button>

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => setShareModal({ ...shareModal, viewState: 'checklist' })}
                    className="text-xs text-white/60 hover:text-white transition-colors cursor-pointer py-1"
                  >
                    {t('modals.updateExportSettingsBtn')}
                  </button>
                  <button
                    onClick={() => setShareModal(null)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-xs transition-colors cursor-pointer"
                  >
                    {t('modals.closeBtn')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}



      {/* Import Code Modal */}
      {showImportCodeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6">
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl text-brand flex items-center gap-2">
              <Download className="w-6 h-6 shrink-0 text-brand" />
              {t('modals.importCodeTitle')}
            </h3>
            <p className="text-white/80 text-sm font-sans">{t('modals.importCodeDesc')}</p>

            <div className="space-y-4">
              <input
                type="text"
                maxLength={6}
                value={importCodeValue}
                onChange={(e) => setImportCodeValue(e.target.value.toUpperCase().trim())}
                placeholder={t('modals.importCodePlaceholder')}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-widest text-white outline-none focus:border-brand transition-colors"
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-3 justify-end items-center">
                <button
                  onClick={() => {
                    setShowImportCodeModal(false);
                    setImportCodeValue('');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]"
                >
                  {t('modals.cancelBtn')}
                </button>
                <button
                  onClick={async () => {
                    if (importCodeValue.length !== 6) {
                      showToast(t('toast.invalidCodeLength'), true);
                      return;
                    }
                    const codeToFetch = importCodeValue;
                    setShowImportCodeModal(false);
                    setImportCodeValue('');
                    showSpinner(t('toast.retrievingSession'));
                    try {
                      const { data, error } = await supabase.rpc('fetch_shared_session', { p_share_id: codeToFetch });
                      if (error || !data) throw new Error('Shared session not found');
                      setImportPreview(data);
                    } catch (e: any) {
                      console.error(e);
                      showToast(t('toast.failedRetrieveShared'), true);
                    } finally {
                      hideSpinner();
                    }
                  }}
                  disabled={importCodeValue.length !== 6}
                  className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand/90 disabled:opacity-20 text-bg-dark transition-colors shadow-lg shadow-brand/30 min-h-[44px]"
                >
                  {t('modals.importSessionBtn')}
                </button>
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink-0 mx-4 text-white/40 text-xs uppercase tracking-widest">{t('modals.or')}</span>
                <div className="flex-grow border-t border-white/10"></div>
              </div>

              <input type="file" id="zoutty-import-file" accept=".zoutty,.zoutty.zip,.zip,application/zip" className="hidden" onChange={handleImportFile} />
              <label htmlFor="zoutty-import-file" className="w-full text-center px-5 py-3 rounded-xl border border-white/10 text-white/80 hover:bg-white/5 transition-colors cursor-pointer">
                {t('modals.importFromFile')}
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6">
          <div className="glass p-8 max-w-md w-full space-y-6 animate-in zoom-in-95 max-h-[85vh] overflow-y-auto">
            <h3 className="text-xl text-brand flex items-center gap-2">
              <Share2 className="w-6 h-6 shrink-0" />
              {t('modals.sharedSession')}
            </h3>
            <p className="text-white/80 text-sm font-sans">{t('modals.sharedSessionDesc')}</p>

            <div className="bg-black/30 p-5 rounded-2xl border border-white/10 space-y-3.5">
              <div>
                <span className="text-xs uppercase tracking-widest text-brand block">{t('modals.sharedTitle')}</span>
                <span className="text-sm text-white">{importPreview.title}</span>
              </div>
              {importPreview.subtitle && (
                <div>
                  <span className="text-xs uppercase tracking-widest text-brand block">{t('modals.sharedSubtitle')}</span>
                  <span className="text-sm text-white/80">{importPreview.subtitle}</span>
                </div>
              )}
              {importPreview.notes && (
                <div>
                  <span className="text-xs uppercase tracking-widest text-brand block">{t('modals.sharedNotesShared')}</span>
                  <span className="text-xs text-green-400 block mt-1 font-sans">{t('modals.sharedNotesIncluded')}</span>
                </div>
              )}
              {importPreview.report && (
                <div>
                  <span className="text-xs uppercase tracking-widest text-brand block">{t('modals.sharedReportShared')}</span>
                  <span className="text-xs text-green-400 block mt-1 font-sans">{t('modals.sharedReportIncluded')}</span>
                </div>
              )}
              {importPreview.transcripts && (
                <div>
                  <span className="text-xs uppercase tracking-widest text-brand block">{t('modals.sharedClipsShared')}</span>
                  <span className="text-xs text-blue-400 block mt-1 font-sans">{t('modals.sharedClipsIncluded', { count: importPreview.transcripts.length })}</span>
                </div>
              )}
              {(importPreview.parsedMediaFiles?.filter((f: any) => !f.isAudioEntry).length > 0 || (importPreview.mediaItems && importPreview.mediaItems.length > 0)) && (
                <div>
                  <span className="text-xs uppercase tracking-widest text-brand block">{t('modals.sharedMediaShared')}</span>
                  <span className="text-xs text-purple-400 block mt-1 font-sans">
                    {t('modals.sharedMediaIncluded', { count: (importPreview.parsedMediaFiles?.filter((f: any) => !f.isAudioEntry).length || 0) + (importPreview.mediaItems?.length || 0) })}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end items-center">
              <button
                onClick={() => {
                  window.history.replaceState({}, document.title, window.location.pathname);
                  setImportPreview(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]"
              >
                {t('modals.rejectBtn')}
              </button>
              <button
                onClick={handleImportSession}
                className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand/90 text-bg-dark transition-colors shadow-lg shadow-brand/30 min-h-[44px]"
              >
                {t('modals.importSessionBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <header className="max-w-2xl mx-auto w-full px-4 sm:px-5 py-4 sm:py-7 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {(view === 'detail' || (view === 'list' && selectedGroupId !== null)) && (
            <button
              onClick={() => {
                window.history.back();
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
          <button
            onClick={() => navigateTo('list', null, null)}
            className="hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-xl shrink-0"
            title={t('goToHome')}
          >
            <ZouttyIcon className="w-8 h-8 sm:w-10 sm:h-10 text-brand shrink-0" />
          </button>
          <div className="flex flex-col justify-center min-w-0">
            <h1 className="text-base sm:text-lg uppercase tracking-[0.2em] text-brand font-bold font-logo leading-none truncate">
              {t('appName')}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="hidden sm:block text-[10px] tracking-[0.04em] text-white/50 leading-none truncate">
                {t('appSubtitle')}
              </p>
              {isGuestMode && (
                <span className="px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] uppercase tracking-wider bg-white/10 text-white/70 border border-white/10 leading-none">
                  {t('guestModeBadge')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Test Lab Access Button */}
          <button
            onClick={() => setShowTestLabModal(true)}
            className={`h-9 sm:h-10 px-2 flex items-center gap-1.5 transition-all text-xs cursor-pointer hover:opacity-80 ${
              devState.mockGemini
                ? 'text-brand'
                : 'text-white/60 hover:text-white'
            }`}
            title={t('billing.dev.panelTitle')}
          >
            <FlaskConical className={`w-4 h-4 ${devState.mockGemini ? 'text-brand animate-pulse' : 'text-zinc-400'}`} />
            <span className="hidden sm:inline text-[11px] font-mono tracking-wider">
              {devState.mockGemini ? 'Mock Active' : 'Lab'}
            </span>
          </button>

          {view === 'list' && (
            <>
              <button
                onClick={() => setShowSearchModal(true)}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-white/40 hover:text-brand transition-colors cursor-pointer"
                title="Search"
              >
                <Search className="w-5 h-5 text-brand" />
              </button>
              <button
                id="onboarding-settings-btn"
                onClick={() => setShowAppSettings(true)}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-white/40 hover:text-brand transition-colors cursor-pointer"
                title="Zoutty Settings"
              >
                <Settings className="w-5 h-5 text-brand" />
              </button>
            </>
          )}
          {view === 'detail' && selectedSession && (() => {
            const hasExportableContent = !selectedSession.isDemo && (
              !!selectedSession.summary ||
              !!selectedSession.notes ||
              Object.values(audioEntries).some(e => e.sessionId === selectedSession.id && (!!e.transcript || !!e.audioBlob || !!e.audio_storage_path)) ||
              sessionMedia.some(m => m.sessionId === selectedSession.id)
            );
            return (
            <>
              <button
                id="onboarding-share-btn"
                onClick={async () => {
                  if (selectedSession.isDemo) {
                    showToast(t('onboarding.demoTooltipShare'), false);
                  } else {
                    const report = await db.getSessionFinalReport(selectedSession.id);
                    const hasReport = !!selectedSession.summary && !!report;
                    const hasNotes = !!selectedSession.notes;
                    const hasTranscripts = Object.values(audioEntries).some(e => e.sessionId === selectedSession.id && !!e.transcript);

                    const hasStrictSummary = hasReport && !!report.report?.strictSummary && report.report.strictSummary.length > 0;
                    const hasDrills = hasReport && !!report.report?.expandedInsights?.drills && report.report.expandedInsights.drills.length > 0;
                    const hasHomework = hasReport && !!report.report?.expandedInsights?.homework && report.report.expandedInsights.homework.length > 0;
                    const hasTechnical = hasReport && !!report.report?.expandedInsights?.technicalExpansion && report.report.expandedInsights.technicalExpansion.length > 0;
                    const hasEmotional = hasReport && !!report.report?.expandedInsights?.emotionalNotes && report.report.expandedInsights.emotionalNotes.length > 0;
                    const currentSessionMedia = sessionMedia.filter(m => m.sessionId === selectedSession.id);
                    const hasMedia = currentSessionMedia.length > 0;
                    const totalMediaBytes = currentSessionMedia.reduce((acc, m) => acc + (m.size || 0), 0);
                    const HEAVY_MEDIA_THRESHOLD = 10 * 1024 * 1024; // 10 MB
                    const hasHeavyMedia = totalMediaBytes >= HEAVY_MEDIA_THRESHOLD;

                    const hasOldShareCode = !!selectedSession.shareId && !selectedSession.shareMethod;
                    const defaultViewState = (selectedSession.shareMethod === 'code' || hasOldShareCode) ? 'active_code' 
                                           : selectedSession.shareMethod === 'file' ? 'active_file' 
                                           : 'checklist';

                    setShareModal({
                      sessionId: selectedSession.id,
                      shareReport: selectedSession.sharedContent ? selectedSession.sharedContent.report : hasReport,
                      shareNotes: selectedSession.sharedContent ? selectedSession.sharedContent.notes : hasNotes,
                      shareTranscripts: selectedSession.sharedContent ? selectedSession.sharedContent.transcripts : hasTranscripts,
                      shareStrictSummary: hasStrictSummary,
                      shareDrills: hasDrills,
                      shareHomework: hasHomework,
                      shareTechnical: hasTechnical,
                      shareEmotional: hasEmotional,
                      shareMedia: selectedSession.sharedContent ? selectedSession.sharedContent.media : hasMedia,
                      hasHeavyMedia,
                      availableReport: hasReport,
                      availableNotes: hasNotes,
                      availableTranscripts: hasTranscripts,
                      availableStrictSummary: hasStrictSummary,
                      availableDrills: hasDrills,
                      availableHomework: hasHomework,
                      availableTechnical: hasTechnical,
                      availableEmotional: hasEmotional,
                      availableMedia: hasMedia,
                      generatedLink: selectedSession.shareId ? selectedSession.shareId : undefined,
                      shareCode: selectedSession.shareId ? selectedSession.shareId : undefined,
                      shareTimestamp: selectedSession.shareTimestamp,
                      viewState: defaultViewState,
                      shareMethod: selectedSession.shareMethod || (hasOldShareCode ? 'code' : undefined),
                      sharedContent: selectedSession.sharedContent
                    });
                  }
                }}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-brand hover:opacity-80 transition-colors cursor-pointer"
                title={t('session.shareSession')}
              >
                <Share2 className="w-5 h-5" />
              </button>
              <button
                id="onboarding-export-btn"
                disabled={!hasExportableContent && !selectedSession.isDemo}
                onClick={() => {
                  if (selectedSession.isDemo) {
                    showToast(t('onboarding.demoTooltipExport'), false);
                  } else {
                    setShowExportConfirm(true);
                  }
                }}
                className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center transition-colors ${
                  hasExportableContent || selectedSession.isDemo
                    ? 'text-brand hover:opacity-80 cursor-pointer'
                    : 'text-white/20 cursor-not-allowed'
                }`}
                title={t('session.exportToPDF')}
              >
                <Download className="w-5 h-5" />
              </button>
            </>
            );
          })()}
          {deferredPrompt && (
            <button
              onClick={async () => {
                if (!deferredPrompt) return;
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                if (outcome === 'accepted') {
                  setDeferredPrompt(null);
                }
              }}
              className="flex items-center gap-1.5 px-2 py-2 text-brand hover:opacity-80 transition-opacity font-sans text-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t('installApp')}</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pb-32">
        {view === 'list' ? (
          <div className="space-y-6">
            {/* Home Tab Bar: Lesson History vs Library vs Topics */}
            {!selectedGroupId && (
              <div className="grid grid-cols-3 gap-2 sm:gap-4 border-b border-white/10 mb-6 px-1">
                <button
                  type="button"
                  onClick={() => handleTabChange('history')}
                  className={`flex items-center justify-center gap-1.5 sm:gap-2.5 text-xs sm:text-base pb-3 transition-colors cursor-pointer ${
                    homeTab === 'history'
                      ? 'text-white border-b-2 border-brand -mb-[1px]'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="truncate">{t('home.tabHistory')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('library')}
                  className={`flex items-center justify-center gap-1.5 sm:gap-2.5 text-xs sm:text-base pb-3 transition-colors cursor-pointer ${
                    homeTab === 'library'
                      ? 'text-white border-b-2 border-brand -mb-[1px]'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  <Library className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="truncate">{t('home.tabLibrary')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('topics')}
                  className={`flex items-center justify-center gap-1.5 sm:gap-2.5 text-xs sm:text-base pb-3 transition-colors cursor-pointer ${
                    homeTab === 'topics'
                      ? 'text-white border-b-2 border-brand -mb-[1px]'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  <Tag className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="truncate">{t('home.tabTopics')}</span>
                </button>
              </div>
            )}

            {homeTab === 'history' && !selectedGroupId ? (
              <HistoryView
                sessions={sessions}
                onSelectSession={(sessionId, groupId) => navigateTo('detail', sessionId, groupId)}
                onAddLesson={handleOpenNewSession}
                activeSearch={activeSearch}
                onClearSearch={() => setActiveSearch(null)}
                onOpenSearch={() => setShowSearchModal(true)}
                isLoading={isLoadingData}
              />
            ) : homeTab === 'topics' && !selectedGroupId ? (
              <TopicsView
                sessions={sessions}
                onSelectSession={(sessionId, groupId) => navigateTo('detail', sessionId, groupId)}
                activeSearch={activeSearch}
                onClearSearch={() => setActiveSearch(null)}
                onOpenSearch={() => setShowSearchModal(true)}
              />
            ) : (
              <div className="space-y-8">
                {selectedGroupId && (
                  <div className="flex items-center gap-2 text-sm text-white/40 uppercase tracking-widest">
                    <FolderOpen className="w-4 h-4 text-blue-400" />
                    <span>{t('home.folderBreadcrumb', { name: groups.find(g => g.id === selectedGroupId)?.name || '' })}</span>
                  </div>
                )}

            {/* Action buttons - Compact same-line layout */}
            {activeSearch ? (
              <div 
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-purple-500/5 border border-purple-500/10 hover:bg-purple-500/10 transition-colors cursor-pointer group"
                onClick={() => setShowSearchModal(true)}
              >
                <div className="flex items-center gap-3">
                  <Search className="w-4 h-4 text-purple-400/80 group-hover:text-purple-400 transition-colors" />
                  <span className="text-sm text-white/90">
                    {activeSearch.query ? t('search.searching', { query: activeSearch.query }) : t('search.advancedSearch')}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSearch(null);
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
                  title={t('search.clearSearch')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : selectedGroupId ? (
              <div className="flex justify-center items-center">
                <button
                  id="onboarding-new-session-btn"
                  onClick={handleOpenNewSession}
                  className="py-2 px-3.5 bg-brand/10 border border-brand/20 text-brand text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-brand/20 transition-all rounded-xl shadow-sm glow-brand min-h-[38px] w-[calc((100%-58px)/2)] sm:w-[calc((100%-62px)/2)] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('home.newLesson')}</span>
                </button>
              </div>
            ) : (
              <div className="flex gap-2.5 sm:gap-3">
                <button
                  id="onboarding-new-session-btn"
                  onClick={handleOpenNewSession}
                  className="py-2 px-3.5 bg-brand/10 border border-brand/20 text-brand text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-brand/20 transition-all rounded-xl shadow-sm glow-brand flex-1 min-h-[38px] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('home.newLesson')}</span>
                </button>
                <button
                  onClick={() => setFolderModal({ type: 'create', name: '' })}
                  className="py-2 px-3.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-blue-500/20 transition-all rounded-xl shadow-sm flex-1 min-h-[38px] cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>{t('home.newFolder')}</span>
                </button>
                <button
                  onClick={() => setShowImportCodeModal(true)}
                  className="h-[38px] px-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center gap-1.5 hover:bg-purple-500/20 transition-all rounded-xl shadow-sm shrink-0 cursor-pointer text-xs"
                  title={t('home.importBtnTitle')}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {activeSearch && activeSearch.matchedSessionIds.size === 0 && activeSearch.matchedGroupIds.size === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in">
                <Search className="w-12 h-12 text-white/20 mb-4" />
                <h3 className="text-lg text-white/60">{t('search.noResults')}</h3>
                <p className="text-sm text-white/40 mt-1">{t('search.tryAdjusting')}</p>
              </div>
            )}

            {/* Folders List - Shown in Root */}
            {!selectedGroupId && groups.filter(g => activeSearch ? activeSearch.matchedGroupIds.has(g.id) : g.id !== 'root').length > 0 && (
              <div className="space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <h2 className="text-xs sm:text-sm font-medium tracking-wider uppercase text-blue-400/90">{t('home.foldersHeading')}</h2>

                  {/* Folder Sorting controls bar */}
                  <div className="flex items-center gap-4 text-xs text-white/40 font-sans">
                    <span className="hidden sm:inline">{t('home.sortBy')}</span>
                    <div className="flex gap-3.5">
                      <button
                        onClick={() => handleFolderSortClick('date')}
                        className={`hover:text-white transition-colors flex items-center gap-1 ${folderSortBy === 'date' ? 'text-brand' : ''}`}
                      >
                        {t('home.sortRecent')}
                        {folderSortBy === 'date' && (folderSortOrder === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                      <button
                        onClick={() => handleFolderSortClick('name')}
                        className={`hover:text-white transition-colors flex items-center gap-1 ${folderSortBy === 'name' ? 'text-brand' : ''}`}
                      >
                        {t('home.sortName')}
                        {folderSortBy === 'name' && (folderSortOrder === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                      <button
                        onClick={() => handleFolderSortClick('created')}
                        className={`hover:text-white transition-colors flex items-center gap-1 ${folderSortBy === 'created' ? 'text-brand' : ''}`}
                      >
                        {t('home.sortCreated')}
                        {folderSortBy === 'created' && (folderSortOrder === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col">
                  {sortFolders(groups.filter(g => activeSearch ? activeSearch.matchedGroupIds.has(g.id) : g.id !== 'root')).map(group => (
                    <div
                      key={group.id}
                      onClick={() => navigateTo('list', null, group.id)}
                      className="flex items-center gap-3.5 py-3 px-1 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Folder className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm truncate text-white/90 group-hover:text-blue-300 transition-colors">{group.name}</h3>
                        <p className="text-xs text-white/40 mt-0.5 font-sans">
                          {t('home.sessionCount', { count: sessions.filter(s => s.groupId === group.id).length })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setFolderModal({ type: 'rename', id: group.id, name: group.name })}
                          className="p-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors min-h-[34px] min-w-[34px] flex items-center justify-center"
                          title="Rename folder"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteFolderModal({ id: group.id, name: group.name })}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors min-h-[34px] min-w-[34px] flex items-center justify-center"
                          title="Delete folder"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showSessionsSection && (
              <div className="space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <h2 className="text-xs sm:text-sm font-medium tracking-wider uppercase text-brand/90">
                    {selectedGroupId ? t('home.sessionsInFolderHeading') : t('home.sessionsHeading')}
                  </h2>

                  {/* Sorting controls bar */}
                  <div className="flex items-center gap-4 text-xs text-white/40 font-sans">
                    <span className="hidden sm:inline">{t('home.sortBy')}</span>
                    <div className="flex gap-3.5">
                      <button
                        onClick={() => handleSessionSortClick('date')}
                        className={`hover:text-white transition-colors flex items-center gap-1 ${sessionSortBy === 'date' ? 'text-brand' : ''}`}
                      >
                        {t('home.sortRecent')}
                        {sessionSortBy === 'date' && (sessionSortOrder === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                      <button
                        onClick={() => handleSessionSortClick('name')}
                        className={`hover:text-white transition-colors flex items-center gap-1 ${sessionSortBy === 'name' ? 'text-brand' : ''}`}
                      >
                        {t('home.sortName')}
                        {sessionSortBy === 'name' && (sessionSortOrder === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                      <button
                        onClick={() => handleSessionSortClick('created')}
                        className={`hover:text-white transition-colors flex items-center gap-1 ${sessionSortBy === 'created' ? 'text-brand' : ''}`}
                      >
                        {t('home.sortCreated')}
                        {sessionSortBy === 'created' && (sessionSortOrder === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                    </div>
                  </div>
                </div>

                {sessions.filter(s => selectedGroupId ? s.groupId === selectedGroupId : !s.groupId).length === 0 ? (
                  !selectedGroupId ? (
                    <div className="flex flex-col items-center justify-center p-12 sm:p-20 text-center animate-in fade-in zoom-in duration-500">
                      <div className="relative w-24 h-24 sm:w-32 sm:h-32 mb-6">
                        <div className="absolute inset-0 bg-brand/20 blur-3xl rounded-full animate-pulse" />
                        <Sparkles className="w-full h-full text-brand/60 drop-shadow-[0_0_15px_rgba(45,212,191,0.5)] animate-pulse" style={{ animationDuration: '3s' }} />
                      </div>
                      <h3 className="text-xl sm:text-2xl text-white mb-3 tracking-tight">{t('home.emptyHomeTitle')}</h3>
                      <p className="text-sm sm:text-base text-white/50 max-w-sm leading-relaxed">{t('home.emptyHomeDesc')}</p>
                    </div>
                  ) : (
                    <div className="p-12 text-center text-white/30 border-b border-white/5">
                      <Folder className="w-10 h-10 mx-auto mb-2.5 opacity-20" />
                      <p className="text-sm">{t('home.noSessionsInFolder')}</p>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col">
                    {sortSessions(
                      sessions.filter(s => activeSearch ? activeSearch.matchedSessionIds.has(s.id) : (selectedGroupId ? s.groupId === selectedGroupId : !s.groupId))
                    ).map(session => (
                      <div
                        key={session.id}
                        onClick={() => {
                          navigateTo('detail', session.id, selectedGroupId);
                        }}
                        className={`flex items-center gap-3.5 py-3.5 px-1 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer group ${session.isDemo && sessions.length === 1 ? 'border-brand/40 shadow-[0_0_15px_rgba(45,212,191,0.15)] animate-pulse' : ''}`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                          <FileAudio className="w-4 h-4 text-brand" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm truncate text-white/90 group-hover:text-brand transition-colors">{session.title}</h3>
                          <p className="text-xs text-white/40 mt-0.5 truncate flex items-center gap-1.5 font-sans">
                            <span className="truncate">{session.subtitle || t('home.sessionDefaultSubtitle')}</span>
                            <span className="opacity-40 shrink-0">•</span>
                            <span className="shrink-0">{formatCompactRelativeDate(getSessionLastActivity(session))}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMoveSessionModal({ sessionId: session.id, currentGroupId: session.groupId });
                            }}
                            className="p-2 bg-white/5 text-white/60 hover:text-brand hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center min-h-[34px] min-w-[34px]"
                            title={t('home.moveToFolder')}
                          >
                            <Folder className="w-4 h-4 shrink-0" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDeleteSession(session.id, session.title);
                            }}
                            className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors flex items-center justify-center min-h-[34px] min-w-[34px]"
                            title={t('home.deleteSession')}
                          >
                            <Trash2 className="w-4 h-4 shrink-0" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    ) : selectedSession && (
          <SessionDetail
            session={selectedSession}
            initialAction={pendingSessionAction}
            onClearInitialAction={() => setPendingSessionAction(null)}
            entries={Object.values(audioEntries).filter(e => e.sessionId === selectedSession.id).sort((a, b) => b.timestamp - a.timestamp)}
            processingIds={processingIds}
            onRecording={(blob, lang, silent) => selectedSession.isDemo ? showToast(t('onboarding.demoTooltipRecord'), false) : addAudioEntry(selectedSession.id, blob, lang, 'recording', undefined, silent)}
            onAutoStoppedLimit={() => setShowAutoStoppedModal(true)}
            onUpload={(e, lang) => selectedSession.isDemo ? showToast(t('onboarding.demoTooltipUpload'), false) : handleFileUpload(e, lang)}
            onProcessVideo={(file, lang) => selectedSession.isDemo ? (showToast(t('onboarding.demoTooltipUpload'), false), Promise.resolve(false)) : processAndSaveVideo(file, selectedSession.id, lang)}
            onConsolidate={
              activeGlossaryIds.length === 0 
                ? () => setShowMandatoryGlossaryModal(true)
                : isGuestMode 
                ? () => setShowGuestLockModal(true) 
                : selectedSession.isDemo 
                ? () => showToast(t('onboarding.demoTooltipConsolidate'), false) 
                : handleConsolidate
            }
            onUpdateSession={(changes) => updateSession(selectedSession.id, changes)}
            onUpdateEntry={(id, changes) => selectedSession.isDemo ? showToast(t('onboarding.demoTooltipEdit'), false) : updateAudioEntry(id, changes)}
            onDeleteEntry={(id) => selectedSession.isDemo ? showToast(t('onboarding.demoTooltipDelete'), false) : requestDeleteAudio(id, 'Audio Entry')}
            onProcessEntry={async (id) => {
              if (activeGlossaryIds.length === 0) {
                setShowMandatoryGlossaryModal(true);
              } else if (isGuestMode) {
                setShowGuestLockModal(true);
              } else if (selectedSession.isDemo) {
                showToast(t('onboarding.demoTooltipConsolidate'), false);
              } else {
                await handleProcessEntry(id);
              }
            }}
            onRequestReprocess={(id) => isGuestMode ? setShowGuestLockModal(true) : selectedSession.isDemo ? showToast(t('onboarding.demoTooltipReprocess'), false) : setReprocessModal(id)}
            activeGlossaryIds={activeGlossaryIds}
            onUpdateActiveGlossaryIds={updateActiveGlossaryIds}
            showToast={showToast}
            groups={groups}
            glossaries={glossaries}
            onDeleteSession={() => requestDeleteSession(selectedSession.id, selectedSession.title)}
            mediaItems={sessionMedia}
            onMediaChange={setSessionMedia}
            existingTopics={allExistingTopics}
          />
        )}
      </main>

      {/* Interactive Onboarding Tour Overlay */}
      {onboardingTourStep !== null && (
        <InteractiveOnboardingOverlay
          currentStep={onboardingTourStep}
          totalSteps={ONBOARDING_STEPS.length - 1}
          stepConfig={ONBOARDING_STEPS[onboardingTourStep]}
          onNext={handleTourNext}
          onPrev={handleTourPrev}
          onSkip={handleTourSkip}
          onFinish={handleTourFinish}
          onTargetClick={handleTourNext}
        />
      )}
    </div>
  );
}

// --- Sub-Components ---

function SessionDetail({
  session,
  initialAction,
  onClearInitialAction,
  entries,
  processingIds,
  onRecording,
  onAutoStoppedLimit,
  onUpload,
  onProcessVideo,
  onConsolidate,
  onUpdateSession,
  onUpdateEntry,
  onDeleteEntry,
  onProcessEntry,
  onRequestReprocess,
  showToast,
  groups,
  glossaries,
  onDeleteSession,
  mediaItems,
  onMediaChange,
  activeGlossaryIds,
  onUpdateActiveGlossaryIds,
  existingTopics = []
}: {
  session: Session;
  initialAction?: 'record' | 'upload_audio' | 'upload_video' | null;
  onClearInitialAction?: () => void;
  entries: AudioEntry[];
  processingIds: Set<string>;
  onRecording: (blob: Blob, lang: Language, silent?: boolean) => void;
  onAutoStoppedLimit?: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, lang: Language) => void;
  onProcessVideo?: (file: File, lang: Language) => Promise<boolean>;
  onConsolidate: () => void;
  onUpdateSession: (changes: Partial<Session>) => void;
  onUpdateEntry: (id: string, changes: Partial<AudioEntry>) => void;
  onDeleteEntry: (entryId: string) => void;
  onProcessEntry: (entryId: string) => Promise<void>;
  onRequestReprocess: (id: string) => void;
  showToast: (msg: string, isError?: boolean, actionText?: string, onAction?: () => void, duration?: number, variant?: 'success' | 'error' | 'warning' | 'info') => void;
  groups: SessionGroup[];
  glossaries: DanceGlossary[];
  onDeleteSession: () => void;
  mediaItems: SessionMedia[];
  onMediaChange: (items: SessionMedia[]) => void;
  activeGlossaryIds: string[];
  onUpdateActiveGlossaryIds: (ids: string[]) => void;
  existingTopics?: string[];
}) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef<any>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isAddingMedia, setIsAddingMedia] = useState(false);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicText, setNewTopicText] = useState('');
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);
  const [mediaObjectUrls, setMediaObjectUrls] = useState<Record<string, string>>({});
  const [brokenMediaIds, setBrokenMediaIds] = useState<Set<string>>(new Set());
  const [lightboxItem, setLightboxItem] = useState<SessionMedia | null>(null);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [mediaToDelete, setMediaToDelete] = useState<SessionMedia | null>(null);
  const [isMediaSectionExpanded, setIsMediaSectionExpanded] = useState(true);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const lessonVideoInputRef = useRef<HTMLInputElement>(null);
  const isFileAccessSupported = false;

  // Revoke object URLs on cleanup
  useEffect(() => {
    return () => {
      Object.values(mediaObjectUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  // Resolve object URLs for media items whenever media items exist or change
  useEffect(() => {
    if (mediaItems.length === 0) return;
    const resolveUrls = async () => {
      const newUrls: Record<string, string> = {};
      const newBroken = new Set<string>();
      for (const item of mediaItems) {
        if (mediaObjectUrls[item.id]) continue; // already resolved
        try {
          let file: File | Blob | null = null;
          if (item.storageMode === 'reference' && item.fileHandle) {
            // Request read permission if needed
            const perm = await item.fileHandle.queryPermission({ mode: 'read' });
            if (perm !== 'granted') {
              await item.fileHandle.requestPermission({ mode: 'read' });
            }
            file = await item.fileHandle.getFile();
          } else if (item.storageMode === 'blob' && item.blob) {
            file = item.blob;
          }
          
          if (file) {
            newUrls[item.id] = URL.createObjectURL(file);
          } else if (item.media_storage_path) {
            const { data } = supabase.storage.from('sessionMedia').getPublicUrl(item.media_storage_path);
            newUrls[item.id] = data.publicUrl;
          } else {
            newBroken.add(item.id);
          }
        } catch {
          newBroken.add(item.id);
        }
      }
      setMediaObjectUrls(prev => ({ ...prev, ...newUrls }));
      setBrokenMediaIds(prev => {
        const next = new Set(prev);
        newBroken.forEach(id => next.add(id));
        return next;
      });
    };
    resolveUrls();
  }, [mediaItems]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAddMedia = async () => {
    if (isFileAccessSupported) {
      // Reference Mode: use File System Access API
      try {
        const handles = await (window as any).showOpenFilePicker({
          multiple: true,
          types: [
            { description: 'Images & Videos', accept: { 'image/*': [], 'video/*': [] } }
          ]
        });
        setIsAddingMedia(true);
        const newItems: SessionMedia[] = [];
        for (const handle of handles) {
          const file: File = await handle.getFile();
          const item: SessionMedia = {
            id: crypto.randomUUID(),
            sessionId: session.id,
            timestamp: Date.now(),
            filename: file.name,
            mimeType: file.type,
            size: file.size,
            storageMode: 'reference',
            fileHandle: handle
          };
          await db.saveMediaItem(item);
          newItems.push(item);
        }
        onMediaChange([...mediaItems, ...newItems]);
        setIsAddingMedia(false);
      } catch (err: any) {
        setIsAddingMedia(false);
        if (err?.name !== 'AbortError') showToast(t('session.galleryFailedAttach'), true);
      }
    } else {
      // Blob Mode: standard file input for Safari/iOS/Firefox
      mediaInputRef.current?.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsAddingMedia(true);
    const MAX_BLOB_SIZE = 500 * 1024 * 1024; // 500 MB hard cap
    const LOW_STORAGE_THRESHOLD = 100 * 1024 * 1024; // warn below 100MB free

    try {
      // Check available storage
      let availableBytes: number | null = null;
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const { quota = 0, usage = 0 } = await navigator.storage.estimate();
        availableBytes = quota - usage;
      }

      const newItems: SessionMedia[] = [];
      for (const file of files) {
        // Validate type
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
          showToast(t('session.galleryUnsupportedType'), true);
          continue;
        }

        // Hard cap
        if (file.size > MAX_BLOB_SIZE) {
          showToast(t('session.galleryFileTooLarge', { size: formatBytes(file.size) }), true);
          continue;
        }
        // Storage warning
        if (availableBytes !== null && availableBytes < LOW_STORAGE_THRESHOLD) {
          showToast(t('session.galleryStorageWarning', {
            available: formatBytes(availableBytes),
            size: formatBytes(file.size)
          }), true);
        }

        let blobToStore: Blob = file;
        // Compress images (not videos)
        if (file.type.startsWith('image/')) {
          try {
            blobToStore = await imageCompression(file, {
              maxWidthOrHeight: 1920,
              useWebWorker: true
            });
          } catch {
            blobToStore = file; // fallback to original on compression failure
          }
        }

        const item: SessionMedia = {
          id: crypto.randomUUID(),
          sessionId: session.id,
          timestamp: Date.now(),
          filename: file.name,
          mimeType: file.type,
          size: blobToStore.size,
          storageMode: 'blob',
          blob: blobToStore,
          isLessonVideo: false
        };
        await db.saveMediaItem(item);
        newItems.push(item);
      }
      if (newItems.length > 0) onMediaChange([...mediaItems, ...newItems]);
    } catch (err) {
      console.error('[Gallery] Failed to attach media:', err);
      showToast(t('session.galleryFailedAttach'), true);
    } finally {
      setIsAddingMedia(false);
      e.target.value = '';
    }
  };

  const deleteMediaItem = async (mediaItem: SessionMedia) => {
    await db.deleteMediaItem(mediaItem.id);
    try {
      let path = mediaItem.media_storage_path;
      if (!path) {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (authSession?.user?.id && mediaItem.sessionId && mediaItem.id) {
          const extMatch = mediaItem.filename?.match(/\.([^.]+)$/);
          const ext = extMatch ? `.${extMatch[1]}` : '';
          path = `${authSession.user.id}/${mediaItem.sessionId}/${mediaItem.id}${ext}`;
        }
      }
      if (path) {
        const { data, error } = await supabase.storage.from('sessionMedia').remove([path]);
        console.log('[Storage] SessionDetail deleteMediaItem remove result:', { path, data, error });
        if (error) {
          console.error('[Storage] Supabase storage remove error:', error);
        } else if (data && data.length === 0) {
          console.warn('[Storage] Supabase storage returned 0 deleted files. Check RLS DELETE policy on storage.objects for bucket "sessionMedia".');
        }
      }
    } catch (err) {
      console.error('[Storage] Failed to remove media file from storage:', err);
    }
  };

  const handleDeleteMediaItem = async (item: SessionMedia) => {
    // Revoke object URL if any
    if (mediaObjectUrls[item.id]) {
      URL.revokeObjectURL(mediaObjectUrls[item.id]);
      setMediaObjectUrls(prev => { const c = { ...prev }; delete c[item.id]; return c; });
    }
    setBrokenMediaIds(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    await deleteMediaItem(item);
    onMediaChange(mediaItems.filter(m => m.id !== item.id));
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  const language = 'auto';
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(session.title);
  const [isEditingSubtitle, setIsEditingSubtitle] = useState(false);
  const [tempSubtitle, setTempSubtitle] = useState(session.subtitle ?? '');
  const [isReordering, setIsReordering] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showRecordCountdown, setShowRecordCountdown] = useState(false);

  const parentGroup = groups.find(g => g.id === session.groupId);

  // Buffered settings states
  const [tempGroupId, setTempGroupId] = useState('');
  const [tempGlossaryId, setTempGlossaryId] = useState('auto');
  const [tempCustomGlossaryStyle, setTempCustomGlossaryStyle] = useState('');
  const [tempActiveGlossaryIds, setTempActiveGlossaryIds] = useState<string[]>(activeGlossaryIds);

  useEffect(() => {
    if (!isSettingsOpen) {
      setTempActiveGlossaryIds(activeGlossaryIds);
    }
  }, [activeGlossaryIds, isSettingsOpen]);

  const handleConfirmSettings = () => {
    if (tempActiveGlossaryIds.length === 0) return;

    let nextGlossaryId = session.glossaryId;
    if (nextGlossaryId && nextGlossaryId !== 'auto' && !tempActiveGlossaryIds.includes(nextGlossaryId)) {
      nextGlossaryId = tempActiveGlossaryIds.length === 1 ? tempActiveGlossaryIds[0] : 'auto';
    } else if (tempActiveGlossaryIds.length === 1) {
      nextGlossaryId = tempActiveGlossaryIds[0];
    } else if (!nextGlossaryId) {
      nextGlossaryId = 'auto';
    }

    onUpdateSession({
      groupId: tempGroupId || undefined,
      glossaryId: nextGlossaryId,
      customGlossaryStyle: tempCustomGlossaryStyle || undefined
    });
    onUpdateActiveGlossaryIds(tempActiveGlossaryIds);
    setIsSettingsOpen(false);
  };

  const handleCancelSettings = () => {
    setIsSettingsOpen(false);
  };

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isCancelledRef = useRef(false);
  const isAutoStopRef = useRef(false);
  const wakeLockRef = useRef<any>(null);

  const startRecording = async () => {
    if (session.isDemo) {
      showToast(t('onboarding.demoTooltipRecord'), false);
      return;
    }
    try {
      isCancelledRef.current = false;
      isAutoStopRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 }
      });

      // Live mic level meter via AudioContext analyser
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setMicLevel(Math.min(1, rms * 6)); // scale so normal speech hits 0.4–0.8
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      animFrameRef.current = requestAnimationFrame(updateLevel);

      // Pick the best supported MIME type so the Blob type is accurate
      const preferredMime = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ].find(t => MediaRecorder.isTypeSupported(t)) || '';
      console.log('[MediaRecorder] Preferred mimeType:', preferredMime || '(browser default)');

      mediaRecorder.current = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : {});
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
          console.log('[MediaRecorder] chunk received, size:', event.data.size, 'total chunks:', audioChunks.current.length);
        }
      };

      mediaRecorder.current.onstop = () => {
        const actualMime = mediaRecorder.current?.mimeType || preferredMime || 'audio/webm';
        // Use plain audio/webm for blob type — codec specifier can confuse some browsers during playback
        const blobType = actualMime.split(';')[0] || 'audio/webm';
        console.log('[MediaRecorder] Actual mimeType after stop:', actualMime);
        console.log('[MediaRecorder] Total chunks:', audioChunks.current.length);
        const audioBlob = new Blob(audioChunks.current, { type: blobType });
        console.log('[MediaRecorder] Blob size:', audioBlob.size, 'type:', audioBlob.type);

        if (isCancelledRef.current) {
          console.log('[MediaRecorder] Recording cancelled, discarding chunks.');
        } else if (isAutoStopRef.current) {
          onRecording(audioBlob, language, true);
          if (onAutoStoppedLimit) onAutoStoppedLimit();
        } else {
          onRecording(audioBlob, language);
        }

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.current.start(250); // 250ms timeslice — guarantees chunks are written regularly
      setIsRecording(true);
      setRecordingDuration(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const next = prev + 1;
          // 2:30 warning toast (150s) with warning orange style
          if (next === TIER_LIMITS.CLIP_WARNING_SECONDS) {
            showToast(t('billing.limits.recordingApproachingLimit'), false, undefined, undefined, 6000, 'warning');
          }
          // 3:00 auto-stop (180s)
          if (next >= TIER_LIMITS.MAX_CLIP_DURATION_SECONDS) {
            setTimeout(() => {
              stopRecording(true);
            }, 0);
          }
          return next;
        });
      }, 1000);

      // Request wake lock to keep screen on while recording
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('[WakeLock] Screen wake lock acquired');
        } catch (err) {
          console.warn('[WakeLock] Failed to acquire wake lock:', err);
        }
      }
    } catch (err) {
      console.error('Error accessing microphone:', err);
      showToast(t('toast.micDenied'), true);
    }
  };

  const stopRecording = (isAutoStop = false) => {
    if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    setMicLevel(0);
    isAutoStopRef.current = isAutoStop;
    mediaRecorder.current?.stop();
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(console.warn);
      wakeLockRef.current = null;
      console.log('[WakeLock] Screen wake lock released');
    }
  };

  const cancelRecording = () => {
    isCancelledRef.current = true;
    stopRecording();
  };

  const handleSubtitleSubmit = () => {
    onUpdateSession({ subtitle: tempSubtitle.trim() });
    setIsEditingSubtitle(false);
  };

  const handleTitleSubmit = () => {
    if (tempTitle.trim() && tempTitle.trim() !== session.title) {
      onUpdateSession({ title: tempTitle.trim() });
    } else {
      setTempTitle(session.title);
    }
    setIsEditingTitle(false);
  };

  const matchingSuggestions = useMemo(() => {
    const trimmed = newTopicText.trim();
    if (!trimmed) return [];
    const normInput = normalizeSearchText(trimmed);
    const currentNormTags = new Set((session.tags || []).map(normalizeSearchText));
    return (existingTopics || [])
      .filter(topic => {
        const norm = normalizeSearchText(topic);
        return !currentNormTags.has(norm) && norm.includes(normInput);
      })
      .slice(0, 5);
  }, [newTopicText, existingTopics, session.tags]);

  const commitTopic = (topicToAdd: string) => {
    const trimmed = topicToAdd.trim();
    if (!trimmed) {
      setIsAddingTopic(false);
      setNewTopicText('');
      setSelectedSuggestionIndex(-1);
      return;
    }
    const currentTags = session.tags || [];
    const normNew = normalizeSearchText(trimmed);
    if (currentTags.some(t => normalizeSearchText(t) === normNew)) {
      showToast(t('session.tagAlreadyExists'), false, undefined, undefined, 2000, 'warning');
      return;
    }
    const existingMatch = (existingTopics || []).find(t => normalizeSearchText(t) === normNew);
    const finalTopic = existingMatch || trimmed;

    const updatedTags = [...currentTags, finalTopic];
    onUpdateSession({ tags: updatedTags });
    setNewTopicText('');
    setSelectedSuggestionIndex(-1);
    setIsAddingTopic(false);
  };

  const handleAddTopic = () => {
    if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < matchingSuggestions.length) {
      commitTopic(matchingSuggestions[selectedSuggestionIndex]);
    } else {
      commitTopic(newTopicText);
    }
  };

  const handleRemoveTopic = (indexToRemove: number) => {
    const currentTags = session.tags || [];
    const updatedTags = currentTags.filter((_, idx) => idx !== indexToRemove);
    onUpdateSession({ tags: updatedTags });
  };

  // Auto-trigger entry action (record, upload audio, upload video)
  useEffect(() => {
    if (!initialAction) return;
    const timer = setTimeout(() => {
      if (initialAction === 'record') {
        if (session.isDemo) {
          showToast(t('onboarding.demoTooltipRecord'), false);
        } else {
          setShowRecordCountdown(true);
        }
      } else if (initialAction === 'upload_audio' || initialAction === 'upload_video') {
        const uploadEl = document.getElementById('uploadBtn') as HTMLInputElement | null;
        if (uploadEl) {
          uploadEl.accept = initialAction === 'upload_video' ? 'video/*' : 'audio/*';
          uploadEl.click();
        }
      }
      onClearInitialAction?.();
    }, 200);
    return () => clearTimeout(timer);
  }, [initialAction]);

  const getDanceStyleLabel = (glossaryId?: string, customStyle?: string) => {
    if (!glossaryId || glossaryId === 'auto') return t('sessionSettings.glossaryAuto');
    if (glossaryId === 'other') return customStyle || t('sessionSettings.glossaryOther');
    const translated = t(`danceStyles.${glossaryId}`);
    if (translated && !translated.startsWith('danceStyles.')) return translated;
    return glossaries.find(g => g.id === glossaryId)?.name || customStyle || 'Brazilian Zouk';
  };

  return (
    <div className="space-y-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Print-only Logo */}
      <div className="hidden print:block text-center pb-4 border-b border-gray-200">
        <img src="/zouttyLogoHoriz.png" alt="Zoutty" className="h-10 mx-auto" />
      </div>
      {/* Session Header: date (white) + optional editable subtitle */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
          {parentGroup ? (
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Folder className="w-3.5 h-3.5 text-brand" />
              <span className="text-white/60">{parentGroup.name}</span>
              <span className="text-white/20">/</span>
            </div>
          ) : (
            <div />
          )}

          {/* Active Dance Style / Glossary Badge */}
          <button
            onClick={() => {
              if (session.isDemo) {
                showToast(t('onboarding.demoTooltipGlossary'), false);
              } else {
                setTempGroupId(session.groupId || '');
                setTempGlossaryId(session.glossaryId || 'auto');
                setTempCustomGlossaryStyle(session.customGlossaryStyle || '');
                setTempActiveGlossaryIds(activeGlossaryIds);
                setIsSettingsOpen(true);
              }
            }}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-brand/10 border border-brand/20 hover:bg-brand/20 transition-all text-brand cursor-pointer"
            title={t('session.sessionSettings')}
          >
            <Music className="w-3 h-3 shrink-0" />
            <span>{getDanceStyleLabel(session.glossaryId, session.customGlossaryStyle)}</span>
          </button>
        </div>
        {/* Date line — always shown, white, bold */}
        {isEditingTitle ? (
          <input
            autoFocus
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSubmit(); if (e.key === 'Escape') { setTempTitle(session.title); setIsEditingTitle(false); } }}
            className="bg-transparent text-xl text-white outline-none w-full py-0.5"
          />
        ) : (
          <p
            className="text-xl text-white cursor-text hover:text-white/80 transition-colors flex items-center gap-2 group w-max"
            onClick={() => {
              if (session.isDemo) {
                showToast(t('onboarding.demoTooltipEdit'), false);
              } else {
                setTempTitle(session.title);
                setIsEditingTitle(true);
              }
            }}
            title={t('session.editTitleHint')}
          >
            {session.title}
            <Edit2 className="w-4 h-4 text-brand opacity-0 group-hover:opacity-80 transition-opacity shrink-0 cursor-pointer print-hide-icon" />
          </p>
        )}

        {/* Subtitle line — editable, optional */}
        {isEditingSubtitle ? (
          <div className="flex items-center gap-2 mt-2">
            <input
              autoFocus
              placeholder={t('session.addSubtitle')}
              value={tempSubtitle}
              onChange={(e) => setTempSubtitle(e.target.value)}
              onBlur={handleSubtitleSubmit}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubtitleSubmit(); if (e.key === 'Escape') setIsEditingSubtitle(false); }}
              className="bg-transparent text-sm text-white/40 outline-none border-b border-brand/50 w-full py-0.5 placeholder:text-white/20"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between mt-1.5">
            <button
              onClick={() => {
                if (session.isDemo) {
                  showToast(t('onboarding.demoTooltipEdit'), false);
                } else {
                  setIsEditingSubtitle(true);
                }
              }}
              className="text-sm text-white/40 hover:text-white/60 transition-colors text-left flex items-center gap-2 group print-show-flex"
            >
              {session.subtitle ? (
                <span>{session.subtitle}</span>
              ) : (
                <span className="italic text-white/20 group-hover:text-white/40">{t('session.subtitlePlaceholder')}</span>
              )}
              <Edit2 className="w-3.5 h-3.5 text-brand opacity-0 group-hover:opacity-80 transition-opacity shrink-0 print-hide-icon" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (session.isDemo) {
                    showToast(t('onboarding.demoTooltipReorder'), false);
                  } else {
                    setIsReordering(!isReordering);
                  }
                }}
                className={`p-2 rounded-xl border transition-colors flex items-center justify-center ${isReordering ? 'bg-brand/20 border-brand text-brand shadow-sm shadow-brand/20' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/80'} min-h-[38px] min-w-[38px]`}
                title={isReordering ? t('session.disableReorder') : t('session.enableReorder')}
              >
                <GripHorizontal className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (session.isDemo) {
                    showToast(t('onboarding.demoTooltipGallery'), false);
                  } else {
                    setIsGalleryOpen(true);
                  }
                }}
                className={`p-2 rounded-xl border transition-colors flex items-center justify-center min-h-[38px] min-w-[38px] ${mediaItems.length > 0
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-sm'
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/80'
                  }`}
                title={t('session.openGallery')}
              >
                <Images className={`w-4 h-4 ${mediaItems.length > 0 ? '' : 'text-brand'}`} />
              </button>
              <button
                onClick={() => {
                  if (session.isDemo) {
                    showToast(t('onboarding.demoTooltipSettings'), false);
                  } else {
                    setTempGroupId(session.groupId || '');
                    setTempGlossaryId(session.glossaryId || 'auto');
                    setTempCustomGlossaryStyle(session.customGlossaryStyle || '');
                    setTempActiveGlossaryIds(activeGlossaryIds);
                    setIsSettingsOpen(true);
                  }
                }}
                className="p-2 rounded-xl border bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors flex items-center justify-center min-h-[38px] min-w-[38px]"
                title={t('session.sessionSettings')}
              >
                <SlidersHorizontal className="w-4 h-4 text-brand" />
              </button>
            </div>
          </div>
        )}

        {/* Topic Tags / Chips section */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 pb-2.5 border-t border-b border-white/5">
          <div className="flex items-center gap-1 text-white/40 text-xs mr-1 shrink-0">
            <Tag className="w-3.5 h-3.5 text-brand/70" />
            <span className="hidden sm:inline">{t('session.topicsHeading')}:</span>
          </div>

          {(session.tags || []).map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-brand/10 border border-brand/20 text-brand-light text-xs group transition-colors hover:bg-brand/15"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (session.isDemo) {
                    showToast(t('onboarding.demoTooltipEdit'), false);
                  } else {
                    handleRemoveTopic(idx);
                  }
                }}
                className="text-brand/50 hover:text-white transition-colors p-0.5 rounded-md hover:bg-white/10 cursor-pointer"
                title={t('session.removeTopic')}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {isAddingTopic ? (
            <div className="relative inline-flex items-center">
              <div className="inline-flex items-center gap-1 bg-white/5 border border-brand/40 rounded-xl px-2 py-0.5">
                <input
                  autoFocus
                  placeholder={t('session.topicPlaceholder')}
                  value={newTopicText}
                  maxLength={35}
                  onChange={(e) => {
                    setNewTopicText(e.target.value);
                    setSelectedSuggestionIndex(-1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedSuggestionIndex(prev =>
                        prev < matchingSuggestions.length - 1 ? prev + 1 : 0
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedSuggestionIndex(prev =>
                        prev > 0 ? prev - 1 : matchingSuggestions.length - 1
                      );
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTopic();
                    } else if (e.key === 'Escape') {
                      setNewTopicText('');
                      setSelectedSuggestionIndex(-1);
                      setIsAddingTopic(false);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setIsAddingTopic(false);
                      setNewTopicText('');
                      setSelectedSuggestionIndex(-1);
                    }, 150);
                  }}
                  className="bg-transparent text-xs text-white outline-none w-24 sm:w-32 placeholder:text-white/30"
                />
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleAddTopic();
                  }}
                  className="text-brand hover:text-brand-light p-0.5 rounded transition-colors cursor-pointer"
                  title={t('session.addTopic')}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewTopicText('');
                    setSelectedSuggestionIndex(-1);
                    setIsAddingTopic(false);
                  }}
                  className="text-white/40 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                  title={t('sessionSettings.cancelBtn')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Autocomplete / Suggested Topics Dropdown */}
              {matchingSuggestions.length > 0 && (
                <div className="absolute left-0 top-full mt-1.5 z-50 bg-[#161b22] border border-white/15 rounded-xl shadow-2xl overflow-hidden py-1 min-w-[150px] max-w-[240px] animate-in fade-in slide-in-from-top-1">
                  <div className="px-2.5 py-1 text-[10px] text-white/40 uppercase tracking-wider border-b border-white/5">
                    {t('session.suggestedTopics')}
                  </div>
                  {matchingSuggestions.map((suggestion, sIdx) => {
                    const isHighlighted = sIdx === selectedSuggestionIndex;
                    return (
                      <button
                        key={suggestion}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          commitTopic(suggestion);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer group ${
                          isHighlighted
                            ? 'bg-brand/25 text-brand'
                            : 'text-white/80 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span className="truncate">{suggestion}</span>
                        <Plus className="w-3 h-3 shrink-0 opacity-40 group-hover:opacity-100 text-brand" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (session.isDemo) {
                  showToast(t('onboarding.demoTooltipEdit'), false);
                } else {
                  setIsAddingTopic(true);
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-brand text-xs transition-colors cursor-pointer"
              title={t('session.addTopic')}
            >
              <Plus className="w-3 h-3" />
              <span>{t('session.addTopic')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Lesson Video Section */}
      {(() => {
        const lessonVideos = mediaItems.filter(m => m.mimeType?.startsWith('video/') && m.isLessonVideo !== false);
        if (lessonVideos.length === 0) return null;

        return (
          <div className="border-b border-white/5 !mt-0 py-2.5 space-y-3.5 transition-all duration-300">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsMediaSectionExpanded(!isMediaSectionExpanded)}
                className="flex items-center gap-2 group cursor-pointer text-left"
                title={isMediaSectionExpanded ? t('session.collapseMedia') : t('session.expandMedia')}
              >
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                  <Video className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm text-white tracking-wide group-hover:text-amber-300 transition-colors">
                  {t('session.lessonVideo')}
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/70 font-mono">
                  {lessonVideos.length}
                </span>
                <div className="p-1 rounded-md text-white/40 group-hover:text-white transition-colors">
                  {isMediaSectionExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => lessonVideoInputRef.current?.click()}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer py-1 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20"
                  title={t('session.addLessonVideo')}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('session.addLessonVideo')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsGalleryOpen(true)}
                  className="text-xs text-white/50 hover:text-white transition-colors flex items-center gap-1 cursor-pointer py-1 px-2 rounded-lg hover:bg-white/5"
                >
                  <span>{t('session.openGalleryHint')}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Collapsible Content */}
            {isMediaSectionExpanded && (() => {
              const primaryItem = (activeMediaId ? lessonVideos.find(m => m.id === activeMediaId) : null)
                || lessonVideos[0];
              const primaryUrl = mediaObjectUrls[primaryItem.id];

              return (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div
                    onClick={() => setLightboxItem(primaryItem)}
                    className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 aspect-video max-h-72 w-full flex items-center justify-center group cursor-pointer hover:border-amber-400/40 transition-all shadow-inner"
                  >
                    {primaryUrl ? (
                      <>
                        <video
                          src={primaryUrl}
                          className="w-full h-full object-contain"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-amber-500/80 transition-all shadow-xl">
                            <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white ml-0.5" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="w-6 h-6 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin" />
                    )}

                    {/* Metadata overlay at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between text-xs text-white/80">
                      <span className="truncate max-w-[70%]">{primaryItem.filename}</span>
                      <span className="text-[11px] text-white/50 shrink-0 font-mono">{formatBytes(primaryItem.size)}</span>
                    </div>
                  </div>

                  {/* Video selector strip when there are multiple lesson videos */}
                  {lessonVideos.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
                      {lessonVideos.map(item => {
                        const itemUrl = mediaObjectUrls[item.id];
                        const isSelected = item.id === primaryItem.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setActiveMediaId(item.id)}
                            className={`w-14 h-14 rounded-xl overflow-hidden border shrink-0 relative group cursor-pointer bg-black/30 transition-all ${
                              isSelected
                                ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-md scale-105'
                                : 'border-white/10 hover:border-white/30 opacity-70 hover:opacity-100'
                            }`}
                            title={item.filename}
                          >
                            {itemUrl ? (
                              <>
                                <video src={itemUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                  <Play className="w-3.5 h-3.5 fill-white text-white" />
                                </div>
                              </>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="w-3 h-3 border border-white/20 border-t-purple-400 rounded-full animate-spin" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}

      <div id="sessionDetailContent" className="!mt-0">
        <SessionStructuredData
          sessionId={session.id}
          entries={entries}
          processingIds={processingIds}
          isReordering={isReordering}
          onToggleReordering={() => setIsReordering(false)}
          onUpdateEntry={onUpdateEntry}
          onDeleteEntry={onDeleteEntry}
          onProcessEntry={onProcessEntry}
          onRequestReprocess={onRequestReprocess}
          cardOrder={session.cardOrder}
          onUpdateOrder={(newOrder) => onUpdateSession({ cardOrder: newOrder })}
          sessionNotes={session.notes}
          onUpdateNotes={(newNotes) => onUpdateSession({ notes: newNotes })}
          onTouchSession={() => onUpdateSession({ lastModified: Date.now() })}
          showToast={showToast}
        />
      </div>

      {/* Spacer to ensure scrolling past the floating bottom controls */}
      <div className="h-32 shrink-0 w-full" />

      {/* Controls - Floating at bottom */}
      <div className="fixed bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 glass p-4 rounded-full flex items-center justify-center gap-4 sm:gap-6 shadow-2xl z-40 border border-white/10 bg-black/60 backdrop-blur-md print-hide">

        {isRecording && (
          <div className={`absolute -top-12 left-1/2 -translate-x-1/2 text-white text-xs px-3.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg border backdrop-blur-md animate-in slide-in-from-bottom-2 duration-300 ${
            recordingDuration >= TIER_LIMITS.CLIP_COUNTDOWN_SECONDS
              ? 'bg-amber-600/95 border-amber-400 animate-pulse text-amber-100 shadow-amber-500/30 ring-2 ring-amber-400/50'
              : recordingDuration >= TIER_LIMITS.CLIP_WARNING_SECONDS
              ? 'bg-amber-500/90 border-amber-300 text-amber-50 animate-pulse ring-2 ring-amber-400/60 shadow-amber-500/30'
              : 'bg-red-600/90 border-red-500/30'
          }`}>
            <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
            <span className="font-mono">{formatDuration(recordingDuration)}</span>
            {recordingDuration >= TIER_LIMITS.CLIP_COUNTDOWN_SECONDS && (
              <span className="text-[11px] ml-1 text-amber-200">
                ({TIER_LIMITS.MAX_CLIP_DURATION_SECONDS - recordingDuration}s)
              </span>
            )}
          </div>
        )}

        <label
          onClick={(e) => {
            if (session.isDemo) {
              e.preventDefault();
              showToast(t('onboarding.demoTooltipUpload'), false);
            } else {
              const uploadEl = document.getElementById('uploadBtn') as HTMLInputElement | null;
              if (uploadEl) uploadEl.accept = 'audio/*,video/*';
            }
          }}
          className="cursor-pointer flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 rounded-full transition-colors shadow-sm"
        >
          <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
          <input id="uploadBtn" type="file" accept="audio/*,video/*" multiple className="hidden" onChange={(e) => {
            if (!session.isDemo) onUpload(e, language);
          }} />
        </label>

        {isRecording && (
          <button
            onClick={cancelRecording}
            className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-full transition-colors shadow-sm animate-in fade-in zoom-in duration-200"
            title={t('session.cancelRecording')}
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}

        <button
          id="recordBtn"
          onClick={isRecording ? () => stopRecording(false) : startRecording}
          style={isRecording ? {
            boxShadow: `0 0 0 ${4 + micLevel * 16}px rgba(${recordingDuration >= TIER_LIMITS.CLIP_WARNING_SECONDS ? '245,158,11' : '239,68,68'},${0.3 + micLevel * 0.6})`
          } : {}}
          className={`flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full transition-all shadow-lg ${isRecording
            ? (recordingDuration >= TIER_LIMITS.CLIP_WARNING_SECONDS ? 'bg-amber-500 text-white hover:bg-amber-600 scale-95 animate-pulse ring-4 ring-amber-400/50' : 'bg-red-500 text-white hover:bg-red-600 scale-95 animate-pulse')
            : 'bg-brand text-black hover:bg-brand-light hover:scale-105'
            } min-h-[64px] min-w-[64px]`}
          title={isRecording ? t('session.stopRecording') : t('session.startRecording')}
        >
          {isRecording ? <Square className="w-6 h-6 sm:w-8 sm:h-8" /> : <Mic className="w-6 h-6 sm:w-8 sm:h-8" />}
        </button>

        <button
          id="consolidateBtn"
          onClick={onConsolidate}
          disabled={entries.length === 0}
          className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-20 transition-colors rounded-full shadow-sm disabled:cursor-not-allowed"
        >
          <Wand2 className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

      {/* Settings Drawer */}
      {isSettingsOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in duration-200"
            onClick={handleCancelSettings}
          />
          {/* Drawer Panel */}
          <div
            className="fixed bottom-0 left-0 right-0 rounded-t-3xl border-t border-white/10 p-6 pb-8 bg-[#1e1e22]/95 backdrop-blur-md z-50 flex flex-col gap-6 shadow-2xl animate-in slide-in-from-bottom duration-300 sm:top-0 sm:bottom-0 sm:right-0 sm:left-auto sm:w-96 sm:rounded-l-3xl sm:rounded-tr-none sm:border-l sm:border-t-0 sm:slide-in-from-right"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-lg text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-brand" />
                {t('sessionSettings.drawerTitle')}
              </h3>
              <button
                onClick={handleCancelSettings}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Folder Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-brand" />
                  {t('sessionSettings.folderLabel')}
                </label>
                <CustomSelect
                  value={tempGroupId || ''}
                  onChange={setTempGroupId}
                  position="relative"
                  options={[
                    { value: '', label: t('sessionSettings.folderNone') },
                    ...groups.map(g => ({ value: g.id, label: g.name }))
                  ]}
                />
              </div>

              {/* Glossary Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-brand" />
                  {t('sessionSettings.glossaryLabel')}
                </label>
                <MultiSelectCombobox
                  selectedValues={tempActiveGlossaryIds}
                  onChange={setTempActiveGlossaryIds}
                  options={SYSTEM_GLOSSARIES.map(g => ({ value: g.id, label: getDanceStyleLabel(g.id) }))}
                  placeholder={t('glossary.searchPlaceholder')}
                />
                {tempActiveGlossaryIds.length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    {t('glossary.requireOne')}
                  </p>
                )}
              </div>


            </div>

            {/* Drawer Footer / Confirm, Cancel, and Delete Actions */}
            <div className="border-t border-white/5 pt-4 mt-auto flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  onClick={handleCancelSettings}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white text-xs min-h-[40px]"
                >
                  {t('sessionSettings.cancelBtn')}
                </button>
                <button
                  onClick={handleConfirmSettings}
                  disabled={tempActiveGlossaryIds.length === 0}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-light text-black transition-colors text-xs min-h-[40px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('sessionSettings.confirmBtn')}
                </button>
              </div>
              <button
                onClick={() => {
                  onDeleteSession();
                }}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:text-white transition-all text-[11px] shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('sessionSettings.deleteSessionBtn')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Hidden file input for blob mode (Safari/iOS) */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Hidden file input for adding lesson videos */}
      <input
        ref={lessonVideoInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          for (const file of files) {
            if (onProcessVideo) {
              await onProcessVideo(file, language);
            }
          }
          e.target.value = '';
        }}
      />

      {/* Gallery Drawer */}
      {isGalleryOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in duration-200"
            onClick={() => {
              setIsGalleryOpen(false);
              setIsDeleteMode(false);
            }}
          />
          {/* Drawer Panel */}
          <div className="fixed bottom-0 left-0 right-0 rounded-t-3xl border-t border-white/10 p-6 pb-8 bg-[#1e1e22]/95 backdrop-blur-md z-50 flex flex-col gap-5 shadow-2xl animate-in slide-in-from-bottom duration-300 sm:top-0 sm:bottom-0 sm:right-0 sm:left-auto sm:w-[480px] sm:rounded-l-3xl sm:rounded-tr-none sm:border-l sm:border-t-0 sm:slide-in-from-right max-h-[90vh] sm:max-h-full">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3 shrink-0">
              <h3 className="text-lg text-white flex items-center gap-2">
                <Images className="w-5 h-5 text-purple-400" />
                {t('session.galleryTitle')}
                {mediaItems.length > 0 && (
                  <span className="text-xs font-normal text-white/40 ml-1">{t('session.galleryItemCount', { count: mediaItems.length })}</span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {mediaItems.length > 0 && (
                  <button
                    onClick={() => setIsDeleteMode(!isDeleteMode)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${isDeleteMode
                      ? 'bg-red-500/20 border-red-500/40 text-red-300'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                      }`}
                  >
                    {isDeleteMode ? t('session.galleryDoneBtn') : t('session.galleryEditBtn')}
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsGalleryOpen(false);
                    setIsDeleteMode(false);
                  }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Storage info note */}
            <div className="shrink-0 text-[11px] text-white/40 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400/70 mt-0.5 shrink-0" />
              <span>{isFileAccessSupported ? t('session.galleryStorageNote') : t('session.galleryBlobNote')}</span>
            </div>

            {/* Content */}
            <div
              className="flex-1 overflow-y-auto space-y-3 pr-1"
              onClick={() => {
                if (isDeleteMode) setIsDeleteMode(false);
              }}
            >
              {mediaItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
                  <Images className="w-10 h-10 opacity-30" />
                  <p className="text-sm">{t('session.galleryEmpty')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {mediaItems.map(item => {
                    const url = mediaObjectUrls[item.id];
                    const broken = brokenMediaIds.has(item.id);
                    const isVideo = item.mimeType.startsWith('video/');
                    return (
                      <div
                        key={item.id}
                        className={`relative group rounded-xl overflow-hidden border bg-black/30 aspect-square transition-all ${isDeleteMode
                          ? 'animate-wiggle border-red-500/40 shadow-lg shadow-red-500/10'
                          : 'border-white/10'
                          }`}
                      >
                        {broken ? (
                          <button
                            className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2 text-center cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isDeleteMode) {
                                setMediaToDelete(item);
                              }
                            }}
                          >
                            <LinkIcon className="w-6 h-6 text-red-400/60" />
                            <p className="text-[9px] text-white/40 leading-tight">{t('session.galleryBrokenLink')}</p>
                          </button>
                        ) : url ? (
                          <button
                            className="w-full h-full cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isDeleteMode) {
                                setMediaToDelete(item);
                              } else {
                                setLightboxItem(item);
                              }
                            }}
                          >
                            {isVideo ? (
                              <video src={url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                            ) : (
                              <img src={url} alt={item.filename} className="w-full h-full object-cover" />
                            )}
                            {isVideo && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                                  <span className="text-white text-xs ml-0.5">▶</span>
                                </div>
                              </div>
                            )}
                          </button>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin" />
                          </div>
                        )}
                        {/* Delete button (visible when in delete mode) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMediaToDelete(item);
                          }}
                          className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600 border border-red-500 text-white transition-all flex items-center justify-center z-10 ${isDeleteMode ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
                            }`}
                          title={t('session.galleryDeleteItem')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {/* Filename tooltip */}
                        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${isDeleteMode ? 'hidden' : ''}`}>
                          <p className="text-[9px] text-white/80 truncate">{item.filename}</p>
                          <p className="text-[8px] text-white/40">{formatBytes(item.size)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add Media Button */}
            <div className="shrink-0 border-t border-white/5 pt-4">
              <button
                onClick={handleAddMedia}
                disabled={isAddingMedia}
                className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl border border-dashed border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400/60 transition-all text-xs shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingMedia ? (
                  <><div className="w-4 h-4 border-2 border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />{t('session.galleryCompressingImage')}</>
                ) : (
                  <><Images className="w-4 h-4" />{t('session.galleryAddBtn')}</>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Lightbox */}
      {lightboxItem && (() => {
        const url = mediaObjectUrls[lightboxItem.id];
        const isVideo = lightboxItem.mimeType.startsWith('video/');
        return (
          <div
            className="fixed inset-0 bg-black/95 z-[60] flex flex-col items-center justify-center animate-in fade-in duration-200"
            onClick={() => setLightboxItem(null)}
          >
            {/* Delete button (Top Left) */}
            <button
              className="absolute top-4 left-4 p-2.5 rounded-full bg-red-600/80 hover:bg-red-600 text-white transition-colors z-30 flex items-center justify-center min-h-[40px] min-w-[40px]"
              onClick={(e) => {
                e.stopPropagation();
                setMediaToDelete(lightboxItem);
              }}
              title={t('session.galleryDeleteItem')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {/* Close button (Top Right) */}
            <button
              className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-30 flex items-center justify-center min-h-[40px] min-w-[40px]"
              onClick={() => setLightboxItem(null)}
            >
              <X className="w-5 h-5" />
            </button>
            {url && (
              isVideo ? (
                <div
                  className="relative w-full h-full max-w-4xl max-h-[80vh] flex items-center justify-center"
                  onClick={e => e.stopPropagation()}
                >
                  <video
                    ref={videoRef}
                    src={url}
                    controls
                    preload="metadata"
                    className="w-full h-full max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200 cursor-pointer"
                  />
                  {/* Invisible click handler overlay for play/pause (leaves space at bottom for native controls) */}
                  <div
                    className="absolute top-0 left-0 right-0 bottom-16 z-10 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoRef.current) {
                        if (videoRef.current.paused) {
                          videoRef.current.play();
                        } else {
                          videoRef.current.pause();
                        }
                      }
                    }}
                  />
                </div>
              ) : (
                <img
                  src={url}
                  alt={lightboxItem.filename}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                  onClick={e => e.stopPropagation()}
                />
              )
            )}
          </div>
        );
      })()}

      {/* Custom App Delete Modal */}
      {mediaToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[70] p-6" onClick={() => setMediaToDelete(null)}>
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5 text-red-500" />
              {t('modals.confirmDeletion')}
            </h3>
            <p className="text-white/70 text-sm">
              {t('session.galleryConfirmDelete')}
            </p>
            <div className="flex gap-3 justify-end items-center mt-6">
              <button
                onClick={() => setMediaToDelete(null)}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] cursor-pointer text-xs"
              >
                {t('modals.cancelBtn')}
              </button>
              <button
                onClick={async () => {
                  const toDelete = mediaToDelete;
                  setMediaToDelete(null);
                  await handleDeleteMediaItem(toDelete);
                  if (lightboxItem?.id === toDelete.id) {
                    setLightboxItem(null);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30 text-white min-h-[44px] cursor-pointer text-xs"
              >
                {t('modals.deleteBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-Second Camera-Style Recording Countdown Overlay */}
      <RecordingCountdownOverlay
        isOpen={showRecordCountdown}
        onComplete={() => {
          setShowRecordCountdown(false);
          startRecording();
        }}
        onCancel={() => {
          setShowRecordCountdown(false);
        }}
      />
    </div>
  );
}

// ─── New display helpers ───────────────────────────────────────────────────

function EditableText({ value, onChange, className, multiline = false, onIntercept }: { value: string, onChange: (v: string) => void, className?: string, multiline?: boolean, onIntercept?: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const handleSubmit = () => {
    if (tempValue.trim() !== value.trim()) {
      onChange(tempValue);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    if (multiline) {
      return (
        <AutoGrowingTextarea
          autoFocus
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleSubmit}
          className={`w-full bg-black/40 text-white/90 p-3 rounded-xl border border-brand/50 outline-none focus:border-brand transition-colors resize-none overflow-hidden text-sm ${className || ''}`}
        />
      );
    }
    return (
      <input
        autoFocus
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') { setTempValue(value); setIsEditing(false); }
        }}
        className={`w-full bg-black/40 text-white/90 p-2 rounded-lg border border-brand/50 outline-none focus:border-brand transition-colors text-sm ${className || ''}`}
      />
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (onIntercept) {
          onIntercept();
        } else {
          setTempValue(value);
          setIsEditing(true);
        }
      }}
      className={`cursor-text hover:bg-white/5 rounded px-1 -mx-1 transition-colors group relative w-full ${className || ''}`}
      title="Click to edit"
    >
      <div className="whitespace-pre-wrap w-full">{value}</div>
      <Edit2 className="w-3.5 h-3.5 text-brand opacity-0 group-hover:opacity-60 absolute top-1 right-1 print-hide-icon" />
    </div>
  );
}

function CollapsiblePanel({ title, children, defaultOpen = true, accent = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean; accent?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="py-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-1.5 text-left transition-colors cursor-pointer group print-show-flex"
      >
        <span className={`text-xs uppercase tracking-widest font-medium ${accent ? 'text-brand/90 group-hover:text-brand' : 'text-white/50 group-hover:text-white/80'}`}>{title}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-white/30 group-hover:text-white/60 transition-transform ${open ? '' : '-rotate-90'} print-hide-icon`} />
      </button>
      <div className={`pt-1.5 pb-2 ${open ? 'block' : 'hidden'} print-expand`}>{children}</div>
    </div>
  );
}

function BulletList({ items, onChange, onIntercept }: { items: string[], onChange?: (newItems: string[]) => void, onIntercept?: () => void }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="space-y-2 mt-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-white/80">
          <div className="w-4 h-4 rounded-full bg-brand/20 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-3 h-3 text-brand" />
          </div>
          <div className="flex-1 w-full min-w-0 pr-2">
            {onChange ? (
              <EditableText
                value={item}
                multiline={true}
                onIntercept={onIntercept}
                onChange={(newVal) => {
                  const copy = [...items];
                  if (!newVal.trim()) {
                    copy.splice(i, 1);
                  } else {
                    copy[i] = newVal;
                  }
                  onChange(copy);
                }}
              />
            ) : (
              <span>{item}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function StrictSummaryBlock({ data, onChange, onIntercept }: { data: string[], onChange?: (newItems: string[]) => void, onIntercept?: () => void }) {
  if (!data || data.length === 0) return <p className="text-white/30 italic text-sm">No strict summary content extracted.</p>;
  return <BulletList items={data} onChange={onChange} onIntercept={onIntercept} />;
}

function ExpandedInsightsBlock({ data, onChange, onIntercept }: { data: ExpandedInsights, onChange?: (newData: ExpandedInsights) => void, onIntercept?: () => void }) {
  const { t } = useTranslation();
  const allEmpty =
    (data.drills?.length ?? 0) === 0 &&
    (data.homework?.length ?? 0) === 0 &&
    (data.technicalExpansion?.length ?? 0) === 0 &&
    (data.emotionalNotes?.length ?? 0) === 0;
  if (allEmpty) return null;

  const handleChange = (key: keyof ExpandedInsights, newItems: string[]) => {
    if (onChange) onChange({ ...data, [key]: newItems });
  };

  const [open, setOpen] = useState(false);

  return (
    <div className="pt-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full py-2 cursor-pointer flex items-center justify-between text-left group print-show-flex"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="text-purple-300 text-xs sm:text-sm font-medium tracking-wide group-hover:text-purple-200 transition-colors">
            {t('session.expandedInsights')}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-purple-400/50 group-hover:text-purple-300 transition-transform ${open ? 'rotate-180' : ''} print-hide-icon`} />
      </button>
      <div className={`pt-2 pb-1 space-y-2 border-l-2 border-purple-500/30 pl-4 ml-1.5 print:bg-transparent ${open ? 'block' : 'hidden'} print-expand`}>
        {(data.drills?.length ?? 0) > 0 && <CollapsiblePanel title={t('session.drills')} defaultOpen={false}><BulletList items={data.drills} onChange={onChange ? (arr) => handleChange('drills', arr) : undefined} onIntercept={onIntercept} /></CollapsiblePanel>}
        {(data.homework?.length ?? 0) > 0 && <CollapsiblePanel title={t('session.homework')} defaultOpen={false}><BulletList items={data.homework} onChange={onChange ? (arr) => handleChange('homework', arr) : undefined} onIntercept={onIntercept} /></CollapsiblePanel>}
        {(data.technicalExpansion?.length ?? 0) > 0 && <CollapsiblePanel title={t('session.technicalExpansion')} defaultOpen={false}><BulletList items={data.technicalExpansion} onChange={onChange ? (arr) => handleChange('technicalExpansion', arr) : undefined} onIntercept={onIntercept} /></CollapsiblePanel>}
        {(data.emotionalNotes?.length ?? 0) > 0 && <CollapsiblePanel title={t('session.emotionalNotes')} defaultOpen={false}><BulletList items={data.emotionalNotes} onChange={onChange ? (arr) => handleChange('emotionalNotes', arr) : undefined} onIntercept={onIntercept} /></CollapsiblePanel>}
      </div>
    </div>
  );
}

function TranscriptBlock({ text, onChange, onIntercept }: { text: string, onChange?: (newText: string) => void, onIntercept?: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="pt-2 print-transcript">
      <button
        onClick={() => setOpen(!open)}
        className="w-full py-2 cursor-pointer flex items-center justify-between text-left group print-show-flex"
      >
        <div className="flex items-center gap-2">
          <FileAudio className="w-4 h-4 text-white/40 shrink-0" />
          <span className="text-white/50 text-xs sm:text-sm group-hover:text-white/80 transition-colors">
            {t('session.viewTranscript')}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-white/30 group-hover:text-white/60 transition-transform ${open ? 'rotate-180' : ''} print-hide-icon`} />
      </button>
      <div className={`pt-2 pb-1 border-l-2 border-white/10 pl-4 ml-1.5 text-white/50 print:text-black/60 text-xs sm:text-sm italic leading-relaxed ${open ? 'block' : 'hidden'} print-expand`}>
        {onChange ? (
          <EditableText value={text} onChange={onChange} multiline={true} className="whitespace-pre-wrap block" onIntercept={onIntercept} />
        ) : (
          <span className="whitespace-pre-wrap">{text}</span>
        )}
      </div>
    </div>
  );
}

function SortableCard({ id, children, isDraggable = true, isReordering = false }: { id: string; children: React.ReactNode; isDraggable?: boolean; isReordering?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isDraggable || !isReordering });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.9 : 1,
    position: 'relative' as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'shadow-2xl scale-[1.02] ring-2 ring-brand rounded-2xl bg-[#141414]' : (isDraggable && isReordering ? 'transition-all ring-2 ring-brand/40 bg-brand/5 rounded-2xl' : 'transition-all')}
    >
      <div className="relative flex items-center">
        <div className={`flex-1 min-w-0 ${isDraggable && isReordering && !isDragging ? 'opacity-80 pointer-events-none' : ''}`}>
          {children}
        </div>
        {isDraggable && isReordering && (
          <div 
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="p-4 cursor-grab active:cursor-grabbing touch-none text-white/40 hover:text-white transition-colors shrink-0 flex items-center justify-center select-none"
            style={{ touchAction: 'none' }}
          >
            <GripVertical className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Session Structured Data ────────────────────────────────────────────────

function SessionStructuredData({ sessionId, entries, processingIds, isReordering, onToggleReordering, onUpdateEntry, onDeleteEntry, onProcessEntry, onRequestReprocess, cardOrder, onUpdateOrder, sessionNotes, onUpdateNotes, onTouchSession, showToast }: { sessionId: string; entries: AudioEntry[]; processingIds: Set<string>; isReordering: boolean; onToggleReordering?: () => void; onUpdateEntry: (id: string, changes: Partial<AudioEntry>) => void; onDeleteEntry: (id: string) => void; onProcessEntry: (id: string) => Promise<void>; onRequestReprocess: (id: string) => void; cardOrder?: string[]; onUpdateOrder: (newOrder: string[]) => void; sessionNotes?: string; onUpdateNotes: (newNotes: string) => void; onTouchSession?: () => void; showToast?: (msg: string, isError?: boolean) => void }) {
  const [report, setReport] = useState<any | null>(null);

  const { t, uiLanguage } = useTranslation();

  const handleIntercept = () => {
    if (sessionId === 'demo-session' && showToast) {
      showToast(t('onboarding.demoTooltipEdit'), false);
    }
  };
  const interceptProp = sessionId === 'demo-session' ? handleIntercept : undefined;

  const formatClipDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthsEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const month = uiLanguage === 'es' ? monthsEs[d.getMonth()] : monthsEn[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  };
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const [isConsolidatedOpen, setIsConsolidatedOpen] = useState(false);
  const [isNoteVisible, setIsNoteVisible] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const dbReport = await db.getSessionFinalReport(sessionId);
        setReport(dbReport || null);
      } catch (err) {
        console.error('Failed to load generic content for session', err);
      }
    };
    load();
    const intervalId = setInterval(load, 2000);
    return () => clearInterval(intervalId);
  }, [sessionId]);

  const isEntryOpen = (id: string) => openStates[id] ?? false;
  const toggleEntry = (id: string) => setOpenStates(prev => ({ ...prev, [id]: !prev[id] }));

  // Parse consolidated report — new shape takes priority, falls back to legacy
  let consolidatedStrictSummary: string[] | null = null;
  let consolidatedExpanded: ExpandedInsights | null = null;
  let consolidatedTranscripts: string | null = null;
  let legacyReportContent: any = null;

  if (report?.report) {
    let r = report.report;
    if (typeof r === 'string') {
      try { r = JSON.parse(r); } catch (e) { r = { RawSummary: r }; }
    }
    if (typeof r === 'object' && r !== null) {
      if (Array.isArray(r.strictSummary)) {
        consolidatedStrictSummary = r.strictSummary as string[];
        consolidatedExpanded = (r.expandedInsights ?? { drills: [], homework: [], technicalExpansion: [], emotionalNotes: [] }) as ExpandedInsights;
        if (r.transcripts && Array.isArray(r.transcripts)) {
          consolidatedTranscripts = r.transcripts.map((t: any) => t.text || '').join('\n\n---\n\n');
        }
      } else {
        // Legacy shape
        const legacyKeys = ['summary', 'homework', 'drills', 'coreConcepts', 'emotionalThemes', 'crossSessionPatterns', 'prioritiesNextLesson'];
        const contentToRender: any = {};
        if (r.transcripts) consolidatedTranscripts = r.transcripts.map((t: any) => t.text || '').join('\n\n---\n\n');
        legacyKeys.forEach(k => {
          if (r[k]) {
            if (Array.isArray(r[k]) && r[k].length > 0 && r[k][0]?.bullet) {
              contentToRender[k] = r[k].map((item: any) => item.bullet);
            } else {
              contentToRender[k] = r[k];
            }
          }
        });
        if (Object.keys(contentToRender).length === 0 && !r.transcripts) Object.assign(contentToRender, r);
        if (Object.keys(contentToRender).length > 0) legacyReportContent = contentToRender;
      }
    }
  }

  const hasConsolidated = consolidatedStrictSummary || legacyReportContent;

  const handleUpdateConsolidated = async (key: string, newValue: any) => {
    if (!report || !report.report || typeof report.report !== 'object') return;
    const newReportData = { ...report.report, [key]: newValue };
    const newDbReport = { ...report, report: newReportData };
    setReport(newDbReport);
    try {
      await db.saveFinalReport(newDbReport);
      onTouchSession?.();
    } catch (e) { console.error(e); }
  };

  const handleUpdateConsolidatedTranscripts = async (newText: string) => {
    if (!report || !report.report || typeof report.report !== 'object') return;
    const newReportData = { ...report.report, transcripts: [{ text: newText }] };
    const newDbReport = { ...report, report: newReportData };
    setReport(newDbReport);
    try {
      await db.saveFinalReport(newDbReport);
      onTouchSession?.();
    } catch (e) { console.error(e); }
  };

  const handleUpdateLegacyConsolidated = async (newObj: any) => {
    if (!report || !report.report || typeof report.report !== 'object') return;
    const newReportData = { ...report.report, ...newObj };
    const newDbReport = { ...report, report: newReportData };
    setReport(newDbReport);
    try {
      await db.saveFinalReport(newDbReport);
      onTouchSession?.();
    } catch (e) { console.error(e); }
  };

  // Determine items to render in sortable list
  const reportId = `report-${sessionId}`;

  // Create an array to map sortable block components
  const availableItems = new Map<string, React.ReactNode>();

  if (hasConsolidated) {
    availableItems.set(reportId, (
      <div className="border-b border-brand/20 transition-colors">
        <div
          className="py-2.5 px-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 cursor-pointer select-none transition-colors hover:bg-white/[0.02] group"
          onClick={() => {
            if (!isReordering) setIsConsolidatedOpen(o => !o);
          }}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-brand drop-shadow-[0_0_8px_rgba(45,212,191,0.5)]" />
            <span className="text-sm sm:text-base font-medium text-brand/90 group-hover:text-brand transition-colors">{t('session.consolidatedReport')}</span>
          </div>
          <div className="flex items-center gap-3">
            {report?.timestamp && (
              <span className="text-[11px] font-sans text-white/40 sm:self-center">
                {t('session.consolidatedOn', { date: formatClipDate(report.timestamp) })}
              </span>
            )}
            <ChevronUp className={`w-4 h-4 text-white/40 group-hover:text-white transition-transform ${isConsolidatedOpen ? '' : 'rotate-180'} print-hide-icon`} />
          </div>
        </div>
        <div className={`py-3 px-1 border-l-2 border-brand/40 pl-4 ml-1 space-y-4 ${!isReordering && isConsolidatedOpen ? 'block' : 'hidden'} print-expand`}>
          {consolidatedStrictSummary && (
            <>
              <div>
                <p className="text-xs uppercase tracking-widest text-brand mb-2">{t('session.strictSummary')}</p>
                <StrictSummaryBlock data={consolidatedStrictSummary} onChange={(s) => handleUpdateConsolidated('strictSummary', s)} onIntercept={interceptProp} />
              </div>
              {consolidatedExpanded && <ExpandedInsightsBlock data={consolidatedExpanded} onChange={(ei) => handleUpdateConsolidated('expandedInsights', ei)} onIntercept={interceptProp} />}
            </>
          )}
          {legacyReportContent && (
            <>
              <StructuredBullets contentObj={legacyReportContent} isReport={true} onChange={handleUpdateLegacyConsolidated} onIntercept={interceptProp} />
            </>
          )}
        </div>
      </div>
    ));
  }

  // Build audio card maps
  entries.forEach((audio, index) => {
    const time = formatClipDate(audio.timestamp);
    const displayTitleRaw = audio.filename || `Audio Entry ${entries.length - index}`;
    const displayTitle = displayTitleRaw.replace(/\.(webm|mp4|mp3|wav|caf)$/i, '');
    const isOpen = !isReordering && isEntryOpen(audio.id);
    const isProcessing = processingIds.has(audio.id);

    const hasNewShape = Array.isArray(audio.strictSummary);
    const legacyContent: any = {};
    if (!hasNewShape) {
      const keys = ['concepts', 'drills', 'homework', 'mechanics', 'emotionalNotes'];
      const src = (audio as any).processedData || audio;
      keys.forEach(k => { if ((src as any)[k]) legacyContent[k] = (src as any)[k]; });
      if (Object.keys(legacyContent).length === 0 && audio.transcript) {
        try {
          const pd = JSON.parse(audio.transcript);
          keys.forEach(k => { if (pd[k]) legacyContent[k] = pd[k]; });
        } catch (_) { }
      }
      if (Object.keys(legacyContent).length === 0 && audio.bulletPoints?.length) {
        legacyContent.bulletPoints = audio.bulletPoints;
      }
    }

    const cardId = `audio-${audio.id}`;
    availableItems.set(cardId, (
      <AudioEntryCard
        key={audio.id}
        displayTitle={displayTitle}
        time={time}
        audio={audio}
        isOpen={isOpen}
        isProcessing={isProcessing}
        hasNewShape={hasNewShape}
        legacyContent={legacyContent}
        onToggle={() => {
          if (!isReordering) toggleEntry(audio.id);
        }}
        onUpdateTitle={(newTitle) => onUpdateEntry(audio.id, { filename: newTitle })}
        onDelete={() => onDeleteEntry(audio.id)}
        onProcess={() => onProcessEntry(audio.id)}
        onRequestReprocess={() => onRequestReprocess(audio.id)}
        onUpdateContent={(changes) => onUpdateEntry(audio.id, changes)}
        showToast={showToast}
      />
    ));
  });

  // Add the Notes Card (always render so it is visible even on empty/new sessions)
  const notesId = `notes-${sessionId}`;
  const notesList = sessionNotes ? sessionNotes.split('\n').filter(n => n.trim().length > 0) : [];

  availableItems.set(notesId, (
    <div className="border-b border-white/5 py-2.5 w-full">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs uppercase tracking-widest text-brand/90 font-medium">{t('session.notesHeading')}</h3>
        {!isNoteVisible && !isReordering && (
          <button
            onClick={() => {
              if (sessionId === 'demo-session' && showToast) {
                showToast(t('onboarding.demoTooltipNotes'), false);
              } else {
                setIsNoteVisible(true);
              }
            }}
            className="text-brand hover:opacity-80 text-xs sm:text-sm transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('session.addNote')}</span>
          </button>
        )}
      </div>

      {notesList.length > 0 && (
        <div className="px-1 mb-3">
          <BulletList 
            items={notesList} 
            onChange={(newList) => onUpdateNotes(newList.join('\n'))}
            onIntercept={interceptProp} 
          />
        </div>
      )}

      {isNoteVisible && !isReordering && (
        <div className="flex flex-col gap-3 mt-3 px-1">
          <AutoGrowingTextarea
            autoFocus
            placeholder={t('session.notesPlaceholder')}
            value={newNoteText}
            onClick={(e) => {
              if (sessionId === 'demo-session' && showToast) {
                e.preventDefault();
                showToast(t('onboarding.demoTooltipNotes'), false);
              }
            }}
            readOnly={sessionId === 'demo-session'}
            onChange={(e) => setNewNoteText(e.target.value)}
            className="w-full min-h-[90px] bg-white/5 text-white/90 p-3.5 rounded-xl border border-white/10 focus:border-brand/40 outline-none transition-colors resize-none overflow-hidden text-sm"
          />
          <div className="flex justify-end gap-2.5">
             <button 
               onClick={() => {
                 setNewNoteText('');
                 setIsNoteVisible(false);
               }}
               className="px-3 py-1.5 text-white/40 hover:text-white text-xs transition-colors cursor-pointer"
             >
               {t('sessionSettings.cancelBtn')}
             </button>
             <button 
               onClick={() => {
                 if (newNoteText.trim()) {
                   const updatedNotes = [...notesList, newNoteText.trim()];
                   onUpdateNotes(updatedNotes.join('\n'));
                   setNewNoteText('');
                   setIsNoteVisible(false);
                 }
               }}
               className="px-3.5 py-1.5 bg-brand/15 border border-brand/30 text-brand hover:bg-brand/25 rounded-xl text-xs transition-colors cursor-pointer"
             >
               {t('sessionSettings.confirmBtn')}
             </button>
          </div>
        </div>
      )}
    </div>
  ));

  // Calculate sorted order 
  const currentKeys = Array.from(availableItems.keys());
  let sortedKeys = cardOrder || [];

  // Add new items that aren't in the saved order yet
  const missingKeys = currentKeys.filter(k => !sortedKeys.includes(k));
  if (missingKeys.length > 0) {
    if (!cardOrder) {
      // Original default logic: Report first, then entries backwards, then notes
      sortedKeys = [];
      if (hasConsolidated) sortedKeys.push(reportId);
      entries.forEach(e => sortedKeys.push(`audio-${e.id}`));
      // Show notes at the bottom by default if visible or if entries > 0 (old behavior logic)
      if (availableItems.has(notesId)) sortedKeys.push(notesId);
    } else {
      // Appended new items
      sortedKeys = [...sortedKeys, ...missingKeys];
    }
  }

  // Filter out items that no longer exist (deleted audios)
  sortedKeys = sortedKeys.filter(k => availableItems.has(k));

  // --- DndKit setup ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      }
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id && over) {
      const oldIndex = sortedKeys.indexOf(active.id as string);
      const newIndex = sortedKeys.indexOf(over.id as string);
      const newOrder = arrayMove(sortedKeys, oldIndex, newIndex);
      onUpdateOrder(newOrder); // pass bubbling up
    }
  };

  return (
    <div className="space-y-0 relative mt-0">
      {isReordering && (
        <div className="flex items-center justify-center mb-6">
          <button
            onClick={() => onToggleReordering?.()}
            className="bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 text-xs uppercase tracking-widest px-4 py-2 rounded-full shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
            title={t('session.disableReorder')}
          >
            <GripHorizontal className="w-4 h-4" /> {t('session.reorderModeActive')}
          </button>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedKeys} strategy={verticalListSortingStrategy}>
          {sortedKeys.map((key) => (
            <SortableCard key={key} id={key} isReordering={isReordering}>
              {availableItems.get(key)}
            </SortableCard>
          ))}
        </SortableContext>
      </DndContext>

      {!hasConsolidated && entries.length === 0 && !sessionNotes && (
        <div className="flex flex-col items-center justify-center pt-2 pb-16 sm:pb-24 text-center px-4 animate-in fade-in duration-500">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-6">
            <div className="absolute inset-0 bg-brand/10 blur-xl rounded-full animate-pulse" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-brand/30 animate-[spin_8s_linear_infinite]" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand/80 animate-spin" style={{ animationDuration: '3s' }} />
            <AudioLines className="w-full h-full p-5 text-brand/60 drop-shadow-[0_0_10px_rgba(45,212,191,0.5)] relative z-10" />
          </div>
          <h3 className="text-lg sm:text-xl text-white mb-2">{t('session.emptySessionTitle')}</h3>
          <p className="text-sm text-white/40 max-w-md leading-relaxed">{t('session.emptySessionDesc')}</p>
        </div>
      )}
    </div>
  );
}

function AudioEntryCard({ displayTitle, time, audio, isOpen, isProcessing, hasNewShape, legacyContent, onToggle, onUpdateTitle, onDelete, onProcess, onRequestReprocess, onUpdateContent, showToast }: {
  displayTitle: string;
  time: string;
  audio: AudioEntry;
  isOpen: boolean;
  isProcessing: boolean;
  hasNewShape: boolean;
  legacyContent: any;
  onToggle: () => void;
  onUpdateTitle: (newTitle: string) => void;
  onDelete: () => void;
  onProcess: () => void;
  onRequestReprocess: () => void;
  onUpdateContent: (changes: Partial<AudioEntry>) => void;
  showToast?: (msg: string, isError?: boolean) => void;
}) {
  const { t } = useTranslation();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(displayTitle);

  const handleIntercept = () => {
    if (audio.sessionId === 'demo-session' && showToast) {
      showToast(t('onboarding.demoTooltipEdit'), false);
    }
  };
  const interceptProp = audio.sessionId === 'demo-session' ? handleIntercept : undefined;

  const handleTitleSubmit = () => {
    if (tempTitle.trim() && tempTitle.trim() !== displayTitle) {
      onUpdateTitle(tempTitle.trim());
    } else {
      setTempTitle(displayTitle);
    }
    setIsEditingTitle(false);
  };

  useEffect(() => {
    if (audio.audioBlob) {
      const url = URL.createObjectURL(audio.audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (audio.audio_storage_path) {
      const { data } = supabase.storage.from('audios').getPublicUrl(audio.audio_storage_path);
      setAudioUrl(data.publicUrl);
    }
  }, [audio.audioBlob, audio.audio_storage_path]);

  return (
    <div className="border-b border-white/5 transition-colors">
      <div
        onClick={(e) => {
          if (!isEditingTitle) onToggle();
        }}
        className="py-2.5 px-1 cursor-pointer flex justify-between items-center hover:bg-white/[0.02] transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            {isEditingTitle ? (
              <input
                autoFocus
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSubmit(); if (e.key === 'Escape') { setTempTitle(displayTitle); setIsEditingTitle(false); } }}
                className="bg-transparent text-sm text-white outline-none w-full"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className={`text-sm text-white flex items-center gap-2 group w-max ${isOpen ? 'cursor-text hover:text-white/80' : ''}`}
                onClick={(e) => {
                  if (isOpen) {
                    e.stopPropagation();
                    if (audio.sessionId === 'demo-session' && showToast) {
                      showToast(t('onboarding.demoTooltipEdit'), false);
                    } else {
                      setTempTitle(displayTitle);
                      setIsEditingTitle(true);
                    }
                  }
                }}
                title={isOpen ? "Edit clip name" : undefined}
              >
                {displayTitle}
                {isOpen && (
                  <Edit2 className="w-3 h-3 text-brand opacity-0 group-hover:opacity-80 transition-opacity shrink-0 cursor-pointer" />
                )}
              </span>
            )}
            <span className="text-xs text-white/40">{time} - {audio.type === 'recording' ? t('session.liveType') : t('session.clipType')}</span>
          </div>
          {isProcessing && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-brand animate-pulse bg-brand/10 px-2.5 py-1 rounded-lg border border-brand/20">{t('session.processing')}</span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
            title={t('common.delete')}
          >
            <Trash2 className="w-4 h-4 shrink-0" />
          </button>
          <ChevronUp className={`w-4 h-4 text-white/40 group-hover:text-white transition-transform ${isOpen ? '' : 'rotate-180'} print-hide-icon`} />
        </div>
      </div>

      <div className={`py-3 px-1 border-l-2 border-white/10 pl-4 ml-1 space-y-4 ${isOpen ? 'block' : 'hidden'} print-expand`}>
        {audioUrl ? (
          <audio 
            controls 
            src={audioUrl} 
            onLoadedMetadata={(e) => {
              const target = e.currentTarget;
              if (target.duration === Infinity || isNaN(target.duration)) {
                target.currentTime = 1e101;
                target.addEventListener('timeupdate', function getDuration() {
                  target.currentTime = 0;
                  target.removeEventListener('timeupdate', getDuration);
                });
              }
            }}
            className="w-full h-9 opacity-85 print-hide my-1" />
        ) : audio.sessionId === 'demo-session' ? (
          <div className="w-full h-10 flex items-center gap-3 bg-white/5 rounded-xl px-4 overflow-hidden relative cursor-not-allowed print-hide">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse-slow"></div>
            <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center shrink-0 shadow-lg shadow-brand/20">
              <Play className="w-3 h-3 text-black fill-black ml-[1.5px]" />
            </div>
            <div className="flex-1 flex items-center justify-between gap-[3px] opacity-50 overflow-hidden px-2">
              {[12, 24, 18, 10, 14, 22, 20, 12, 10, 16, 24, 18, 12, 14, 20, 24, 16, 10, 14, 22, 18, 12, 14, 20, 16, 10, 12, 22, 18, 14].map((h, i) => (
                <div key={i} className="w-1.5 rounded-full bg-brand/60" style={{ height: `${h}px` }}></div>
              ))}
            </div>
            <span className="text-[10px] text-brand/50 font-mono tracking-widest">00:45</span>
          </div>
        ) : null}

        {hasNewShape ? (
          <>
            {audio.strictSummary && (audio.strictSummary as string[]).length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest text-brand mb-2">{t('session.strictSummary')}</p>
                <StrictSummaryBlock data={audio.strictSummary as string[]} onChange={(s) => onUpdateContent({ strictSummary: s })} onIntercept={interceptProp} />
              </div>
            )}
            {audio.expandedInsights && <ExpandedInsightsBlock data={audio.expandedInsights} onChange={(ei) => onUpdateContent({ expandedInsights: ei })} onIntercept={interceptProp} />}
            <TranscriptBlock text={audio.transcript ?? ''} onChange={(t) => onUpdateContent({ transcript: t })} onIntercept={interceptProp} />
          </>
        ) : (
          <>
            {Object.keys(legacyContent).length > 0 ? (
              <div className="print-transcript">
                <StructuredBullets contentObj={legacyContent} onIntercept={interceptProp} onChange={(newObj) => {
                  if ((audio as any).processedData) {
                    onUpdateContent({ processedData: { ...(audio as any).processedData, ...newObj } } as any);
                  } else if (audio.transcript && typeof legacyContent === 'object') {
                    try {
                      onUpdateContent({ transcript: JSON.stringify({ ...JSON.parse(audio.transcript), ...newObj }) });
                    } catch (e) { }
                  } else {
                    onUpdateContent(newObj as any);
                  }
                }} />
              </div>
            ) : isProcessing ? (
              <p className="text-white/40 italic text-sm">{t('session.waitingForContent')}</p>
            ) : null}
            {audio.transcript && !hasNewShape && (
              <div className="mt-3 pt-3 border-t border-white/5 text-sm print-transcript">
                <span className="text-xs uppercase tracking-widest text-white/30 mb-2 block">{t('session.rawTranscript')}</span>
                <EditableText value={audio.transcript} onChange={(t) => onUpdateContent({ transcript: t })} multiline className="text-white/60 italic leading-relaxed whitespace-pre-wrap block" onIntercept={interceptProp} />
              </div>
            )}
          </>
        )}

        {!isProcessing && (
          <div className="mt-3 pt-3 border-t border-white/5 flex justify-end print-hide">
            {(audio.transcript || audio.strictSummary || audio.bulletPoints || Object.keys(legacyContent).length > 0) ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestReprocess();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 hover:bg-brand/20 text-brand rounded-xl border border-brand/20 transition-all text-xs shadow-sm cursor-pointer"
                title={t('session.reprocessClip')}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{t('session.reprocessClip')}</span>
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onProcess();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-brand/10 hover:bg-brand/20 text-brand rounded-xl border border-brand/20 transition-all text-sm shadow-sm"
                title={t('session.processClip')}
              >
                <Zap className="w-4 h-4" />
                {t('session.processClip')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({ title, contentObj, isReport = false, isOpen, onToggle, audioData, onDelete }: any) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (audioData?.audioBlob) {
      const url = URL.createObjectURL(audioData.audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (audioData?.audio_storage_path) {
      const { data } = supabase.storage.from('audios').getPublicUrl(audioData.audio_storage_path);
      setAudioUrl(data.publicUrl);
    }
  }, [audioData?.audioBlob, audioData?.audio_storage_path]);

  if (!contentObj || (Object.keys(contentObj).length === 0 && !audioData)) return null;

  return (
    <div className={`mb-4 border rounded-2xl overflow-hidden shadow-sm transition-all ${isReport ? 'border-brand/40 bg-brand/5' : 'border-white/10 glass'}`}>
      <div
        onClick={onToggle}
        className={`p-4 sm:p-5 cursor-pointer flex justify-between items-center transition-colors ${isReport ? 'bg-brand/10 hover:bg-brand/20' : 'hover:bg-white/5'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isReport ? 'bg-brand/20 text-brand' : 'bg-white/10 text-white/60'}`}>
            {isReport ? <Sparkles className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
          </div>
          <span className="text-base sm:text-lg">{title}</span>
        </div>

        <div className="flex items-center gap-4">
          {audioData && !audioData.transcript && Object.keys(contentObj).length === 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-brand animate-pulse bg-brand/10 px-3 py-1.5 rounded-lg border border-brand/20">
              PROCESSING...
            </div>
          )}
          {audioData && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Trash2 className="w-5 h-5 shrink-0" />
            </button>
          )}
          <ChevronUp className={`w-5 h-5 text-white/40 transition-transform ${isOpen ? '' : 'rotate-180'} print-hide-icon`} />
        </div>
      </div>

      {isOpen && (
        <div className="p-4 sm:p-5 bg-black/20 border-t border-white/5">
          {audioUrl && (
            <audio 
            controls 
            src={audioUrl} 
            onLoadedMetadata={(e) => {
              const target = e.currentTarget;
              if (target.duration === Infinity || isNaN(target.duration)) {
                target.currentTime = 1e101;
                target.addEventListener('timeupdate', function getDuration() {
                  target.currentTime = 0;
                  target.removeEventListener('timeupdate', getDuration);
                });
              }
            }}
            className="w-full h-10 mb-5 opacity-90 transition-opacity rounded-xl bg-black/20 print-hide" />
          )}

          {Object.keys(contentObj).length > 0 ? (
            <StructuredBullets contentObj={contentObj} isReport={isReport} />
          ) : (
            <p className="text-white/40 italic text-sm">Waiting for content generation...</p>
          )}

          {audioData?.transcript && (
            <div className="mt-6 pt-4 border-t border-white/5 text-sm">
              <span className="text-xs uppercase tracking-widest text-white/30 mb-2 block">Raw Transcript</span>
              <p className="text-white/60 italic leading-relaxed">"{audioData.transcript}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StructuredBullets({ contentObj, isReport, onChange, onIntercept }: { contentObj: any, isReport?: boolean, onChange?: (newObj: any) => void, onIntercept?: () => void }) {
  if (!contentObj || typeof contentObj !== 'object') return null;

  const processBulletItem = (origItem: any, key: React.Key, path?: (string | number)[]) => {
    const text = typeof origItem === 'string' ? origItem : JSON.stringify(origItem);
    const lowerText = text.toLowerCase();
    const isHighlight = lowerText.includes('homework') ||
      lowerText.includes('priorit') ||
      lowerText.includes('tarefa') ||
      lowerText.includes('tarea');

    return (
      <li
        key={key}
        className={`flex gap-3 text-sm sm:text-base leading-relaxed mb-3 ${isHighlight ? 'text-red-300 bg-red-500/10 px-4 py-3 rounded-xl border border-red-500/20 shadow-inner' : 'text-white/80'
          }`}
      >
        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${isHighlight ? 'bg-red-500/20' : 'bg-brand/20'}`}>
          <CheckCircle2 className={`w-3.5 h-3.5 ${isHighlight ? 'text-red-400' : 'text-brand'}`} />
        </div>
        <div className="flex-1 w-full min-w-0 pr-2">
          {onChange && path ? (
            <EditableText
              value={text}
              multiline={true}
              onIntercept={onIntercept}
              onChange={(newVal) => {
                const copy = JSON.parse(JSON.stringify(contentObj));
                let curr = copy;
                for (let i = 0; i < path.length - 1; i++) curr = curr[path[i]];
                const last = path[path.length - 1];

                if (!newVal.trim()) {
                  if (typeof last === 'number' && Array.isArray(curr)) {
                    curr.splice(last, 1);
                  } else {
                    delete curr[last];
                  }
                } else {
                  if (typeof origItem === 'string') {
                    curr[last] = newVal;
                  } else {
                    try { curr[last] = JSON.parse(newVal); } catch (e) { curr[last] = newVal; }
                  }
                }
                onChange(copy);
              }}
            />
          ) : (
            <span>{text}</span>
          )}
        </div>
      </li>
    );
  };

  const listItems: React.ReactNode[] = [];
  let keyIdx = 0;

  for (const [key, value] of Object.entries(contentObj)) {
    if (!value || (Array.isArray(value) && value.length === 0)) continue;
    if (typeof value === 'object' && Object.keys(value).length === 0) continue;

    const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    listItems.push(
      <li key={`header-${keyIdx++}`} className={`mt-6 mb-3 uppercase text-xs tracking-widest ${isReport ? 'text-brand' : 'text-white/50'}`}>
        {formattedKey}
      </li>
    );

    if (Array.isArray(value)) {
      value.forEach((item, i) => listItems.push(processBulletItem(item, `arr-${keyIdx}-${i}`, [key, i])));
    } else if (typeof value === 'object') {
      for (const [subKey, subValue] of Object.entries(value)) {
        if (Array.isArray(subValue)) {
          subValue.forEach((item, i) => {
            listItems.push(processBulletItem(`${subKey}: ${item}`, `obj-arr-${keyIdx}-${i}`));
          });
        } else {
          listItems.push(processBulletItem(`${subKey}: ${subValue}`, `obj-${keyIdx}`));
        }
        keyIdx++;
      }
    } else {
      listItems.push(processBulletItem(value, `val-${keyIdx}`, [key]));
    }
    keyIdx++;
  }

  if (listItems.length === 0) return null;
  return <ul className="m-0 p-0 list-none">{listItems}</ul>;
}


