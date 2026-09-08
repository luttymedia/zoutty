export type Language = 'pt-BR' | 'es' | 'en' | 'auto';

// strictSummary is now a flat array of bullet point strings
export type StrictSummary = string[];

export interface ExpandedInsights {
  drills: string[];
  homework: string[];
  technicalExpansion: string[];
  emotionalNotes: string[];
}

export interface AudioEntry {
  id: string;
  sessionId: string;
  timestamp: number;
  language: Language;
  transcript?: string;
  bulletPoints?: string[];
  strictSummary?: StrictSummary;
  expandedInsights?: ExpandedInsights;
  audioBlob?: Blob; // The recorded or uploaded audio blob
  type: 'recording' | 'upload';
  filename?: string; // Original filename if uploaded
  audio_storage_path?: string; // Supabase storage path
  pending_sync?: boolean;
  deleted?: boolean;
}

export interface Session {
  id: string;
  title: string;
  subtitle?: string; // Optional subtitle (editable by user)
  date: number;
  tags?: string[]; // AI-generated or user-defined dance concept topic tags
  summary?: string;
  notes?: string; // Optional user notes
  cardOrder?: string[]; // IDs of cards in preferred order
  groupId?: string; // Optional group folder ID
  glossaryId?: string; // Optional active glossary ID (or 'auto' or 'other')
  customGlossaryStyle?: string; // Optional custom style name if glossaryId is 'other'
  shareId?: string; // Optional share short code ID
  shareTimestamp?: number; // Optional timestamp when the share link was generated
  shareMethod?: 'code' | 'file'; // Optional historical share method
  sharedContent?: {
    report: boolean;
    notes: boolean;
    transcripts: boolean;
    media: boolean;
  };
  isDemo?: boolean; // Indicates if this is a mock/demo session
  lastModified?: number; // Timestamp of explicit modification or last activity
  pending_sync?: boolean;
  deleted?: boolean;
}

export interface SessionGroup {
  id: string;
  name: string;
  dateCreated: number;
  sessionOrder?: string[]; // IDs of sessions in preferred order in this folder
  folderOrder?: string[]; // IDs of folders in preferred order
  pending_sync?: boolean;
  deleted?: boolean;
}

export interface GlossaryItem {
  canonicalTerm: string;
  variants: string[];
  category: string;
}

export interface DanceGlossary {
  id: string;
  name: string;
  terms: GlossaryItem[];
  isSystem?: boolean;
  pending_sync?: boolean;
  deleted?: boolean;
}

export interface FinalReport {
  id: string;
  sessionId: string;
  report: any; // Stored as an object from /api/gemini/process-audio, or legacy string
  timestamp: number;
  pending_sync?: boolean;
  deleted?: boolean;
}

export interface SessionMedia {
  id: string;
  sessionId: string;
  timestamp: number;
  filename: string;
  mimeType: string;
  size: number; // in bytes
  storageMode: 'reference' | 'blob';
  fileHandle?: any; // FileSystemFileHandle — Reference mode (Chrome/Edge desktop)
  blob?: Blob;      // Blob mode — Safari/Firefox/iOS fallback
  media_storage_path?: string; // Supabase storage path
  pending_sync?: boolean;
  deleted?: boolean;
  isLessonVideo?: boolean;
}

// ─── Monetization, Tiers & Billing Types ─────────────────────────────────────

export type UserTier = 'free' | 'student' | 'teacher';

export type SubscriptionStatus =
  | 'none'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid';

export interface UserProfile {
  id: string;
  tier: UserTier;
  subscription_status: SubscriptionStatus;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end: boolean;
  referral_code: string;
  referred_by?: string | null;
  referral_boost_expires_at?: string | null;
  referral_boost_extra_sessions: number;
  referral_boost_extra_clips: number;
  referral_credits_balance: number; // count of €1 discount units remaining
  topup_extra_sessions: number; // non-expiring one-time top-up sessions
  topup_extra_clips: number; // non-expiring one-time top-up clips
  created_at: string;
  updated_at: string;
}

export interface UsageTracking {
  user_id: string;
  lifetime_sessions: number;
  lifetime_clips: number;
  period_sessions: number;
  period_start: string;
  period_end?: string | null;
  updated_at: string;
}

export interface ReferralLog {
  id: string;
  referrer_id?: string | null;
  referred_user_id: string;
  reward_type: 'free_boost' | 'student_credit' | 'teacher_credit';
  reward_value: number;
  status: 'pending' | 'pending_refund_period' | 'active' | 'revoked';
  stripe_invoice_id?: string | null;
  paid_at?: string | null;
  created_at: string;
  activated_at?: string | null;
  revoked_at?: string | null;
}

export const TIER_LIMITS = {
  MAX_CLIP_DURATION_SECONDS: 180, // 3 minutes hard cap
  CLIP_WARNING_SECONDS: 150, // 2:30 warning
  CLIP_COUNTDOWN_SECONDS: 170, // 2:50 countdown start (10s before 180)
  free: {
    lifetime_sessions: 3,
    lifetime_clips: 15,
  },
  student: {
    monthly_sessions: 20,
    monthly_clips: 200,
    price_eur: 2.99,
    referral_discount_per_month_eur: 1.0,
  },
  teacher: {
    monthly_sessions: 100,
    monthly_clips: Infinity,
    price_eur: 12.99,
    referral_credit_eur: 2.0,
    max_monthly_credit_eur: 8.0,
  },
  referral_boost: {
    duration_days: 10,
    extra_sessions: 2,
    extra_clips: 10,
  },
  topup_pack: {
    price_eur: 3.99,
    extra_sessions: 10,
    extra_clips: 100,
  },
} as const;


