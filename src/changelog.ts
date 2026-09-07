export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '3.5.1',
    date: '2026-09-07',
    changes: [
      'Clean Logout & State Reset: Logging out now clears local storage and IndexedDB databases completely while preserving user language preference',
      'Onboarding Fix for New Accounts: Prevented premature onboarding completion on signup and Google OAuth so new users always receive the guide and style selection',
      'Guest Mode Style Selection: Enabled mandatory dance style selection for guest users upon completing onboarding'
    ]
  },
  {
    version: '3.5.0',
    date: '2026-09-07',
    changes: [
      'Automated Supabase Storage Cleanup on Asset Deletion: Deleting audio clips or gallery media files immediately purges the raw assets from Supabase Storage buckets (sessionMedia and audios)',
      'Session-Level Storage Purge: Deleting a session or folder permanently removes all associated audio recordings, media items, and leftover folder placeholders from cloud storage',
      'Sync Engine Guard: Prevented syncEngine from re-uploading deleted media and audio blobs during synchronization cycles and ensured pending deletions clean up remote storage',
      'Storage Health & Orphan Cleanup: Added cleanup utilities to audit and purge orphaned files, legacy placeholders, and assets from previously deleted sessions'
    ]
  },
  {
    version: '3.4.0',
    date: '2026-09-07',
    changes: [
      'User Display Name on Email Signup: Added a display name input to the email signup form, stored in Supabase profiles and auth metadata, with automatic fallback extraction for Google OAuth users',
      'Edit Account Section: Added collapsible account management in settings drawer with pre-filled display name editing, adaptive password setup/change with visibility toggles, and permanent account deletion via server backend',
      'Guest Mode Indicator: Enhanced visibility and status clarity for guest mode users with contextual callouts and action buttons',
      'Unified Dance Style Glossaries: Synchronized dance style selection across sessions, onboarding, and settings into a unified multi-select glossary system with cloud profile persistence'
    ]
  },
  {
    version: '3.3.0',
    date: '2026-09-05',
    changes: [
      'Glossary Refactoring: Preloaded 14 system dance styles with authentic technical terminology, removed legacy custom glossary database bloat, and synced active styles directly to user cloud profiles',
      'AI Transcription & Consolidation Optimization: Injected foreign technical dance terms directly into Gemini prompts in Auto-Detect mode for accurate multi-lingual terminology spelling without token waste',
      'Searchable Multi-Select Combobox: Added searchable comboboxes for dance styles in both session settings and the mandatory style selection modal',
      'Settings Drawer Reordering: Reorganized settings drawer with a compact dance style selector and streamlined preferences'
    ]
  },
  {
    version: '3.2.3',
    date: '2026-09-05',
    changes: [
      'Guest Mode Text Hidden: Removed misleading cloud logout description in settings drawer when using guest mode',
      'Audio Player Duration Fix: Resolved Infinity/NaN duration and playhead jumping on audio clips',
      'Dedicated Drag Handles & Instant Drag: Grip-only card reordering with zero delay and smooth mobile scrolling',
      'Forced Collapsed Cards in Reorder Mode: Keep cards and reports collapsed while sorting for a cleaner reordering view',
      'Install Wall Cleanup: Automatically hide preparing installation text once the PWA install completes',
      'Logo Animation on Fresh Launch: Trigger onboarding brand animation on first device launch',
      'Removed Developer Toggles: Cleaned up settings drawer by moving user tools under "Other" and hiding dev/mock controls'
    ]
  },
  {
    version: '3.2.2',
    date: '2026-08-31',
    changes: [
      'Stripe Integration Data Consistency: Populated current_period_end tracking across Stripe webhooks and Supabase profiles for accurate billing cycle resets',
      'Robust Subscription Cancellation: Fixed backend cancellation crashes by automatically releasing pending downgrade subscription schedules',
      'Reactivation Flow: Added seamless Reactivate Subscription capability directly from the Manage Subscription modal for canceled accounts',
      'Improved Cancellation UI: Added a clear CANCELED badge and correct "Cancels on" date display within the Settings Drawer and Subscription Modal'
    ]
  },
  {
    version: '3.2.1',
    date: '2026-08-27',
    changes: [
      'Cloud Profile & Usage Sync: Automatic real-time syncing of tier, subscription status, and usage counters from Supabase on login, app launch, and post-AI processing',
      'Test Lab Sandbox Isolation: Strict sandbox boundary hiding simulation controls when Mock Mode is disabled, preventing state leakage into live accounts',
      'Usage Tracking Database Enhancement: Added period_clips tracking column and RPC updates to properly enforce Student plan monthly clip quotas and billing resets',
      'Clean Logout & State Reset: Complete local sandbox cache purge on sign-out to prevent cross-account data contamination'
    ]
  },
  {
    version: '3.2.0',
    date: '2026-08-20',
    changes: [
      'Interactive Onboarding Tour: Complete multi-step interactive onboarding guide with targeted spotlights, bouncing indicators, ambient glows, and step-by-step guidance',
      'Demo Session Sandbox: Introduced automated Demo Session generation with sample audio and consolidated report for immediate sandbox practice',
      'Replay Tour Option: Added "Replay Onboarding Tour" button to the Settings drawer to relaunch the interactive walkthrough at any time',
      'Mobile & Tablet Optimization: Responsive clamping, generous clearance, dynamic badge positioning, and flicker-free popover rendering across all device sizes',
      'Full Localization: Complete English and Spanish translations across all onboarding steps, tooltips, and interactive badges'
    ]
  },
  {
    version: '3.1.0',
    date: '2026-08-20',
    changes: [
      'Stripe Promotion Codes: Enabled customer-redeemable promotion codes and discount rules across all Stripe Checkout subscription and top-up flows',
      'Subscription Status Enforcement: Added strict quota enforcement falling back to free tier limits when subscription payments are past due, unpaid, or canceled',
      'Payment Issue UI Warning Banner: Added dismissible sticky banner and dedicated Quota Exceeded modal alert directing users to the Stripe Customer Portal',
      'Test Lab Sandbox Enhancements: Added 1-click Past Due preset and updated status labels for testing failed payment scenarios',
      'Audio Processing & Consolidation Resilience: Hardened audio payload serialization and base64 conversion against non-blob or missing media entries'
    ]
  },
  {
    version: '3.0.1',
    date: '2026-08-18',
    changes: [
      'Guest Mode enhancements: strict backend quota enforcement, new Guest AI locked modal, and non-technical terminology updates'
    ]
  },
  {
    version: '3.0.0',
    date: '2026-08-18',
    changes: [
      'Slice 1 - Stripe & Pricing Foundation: Student (€2.99/mo) & Teacher (€12.99/mo) Stripe Checkout, Webhook handlers, and live Supabase profile syncing',
      'Slice 2 - Quota & Usage Enforcement: Server gatekeeper enforcing session & clip limits, 3-minute hard audio cap modal, and Quota Exceeded Modal',
      'Slice 3 - Subscription Management: Manage Subscription modal, upgrade/downgrade/cancel retention flows, and Stripe Customer Portal integration',
      'Slice 4 - Offline-First Resilience: Dexie / SQLite local storage caching, network failure resilience, and offline guides',
      'Slice 5 - Test Lab Sandbox Suite: Complete DevState simulator with 5 presets, mock Gemini toggle, and real-time counter manipulation',
      'Slice 6 - Referral Program Ecosystem: Referral link tracking (?ref=CODE), Sign-Up invite badge, 14-day refund window, 10-day non-stackable boosts for Free tier, dynamic discount allocations (€1–€8/mo) for Paid tiers, and responsive modal styling',
      'Slice 7 - One-Time AI Top-Up Pack: €3.99 Top-Up Pack (+10 Sessions / +100 Clips), Plan-First consumption, rollover protection across renewals, celebratory Top-Up Success modal, in-drawer action buttons, and Unlimited clips terminology'
    ]
  },
  {
    version: '2.3.1',
    date: '2026-07-31',
    changes: [
      'Added an abort/cancel feature to the loading screen ("Working our Zoutty magic...") for both audio consolidation and transcription operations'
    ]
  },
  {
    version: '2.3.0',
    date: '2026-06-25',
    changes: [
      'Implemented a cloud-first storage fallback system that saves data directly to Supabase when the device storage is full',
      'Added a "Running on cloud" banner to alert users when their local storage is exhausted',
      'Ensured app data is fetched automatically from the cloud on startup if the local database was unable to save',
      'Added fallback handling and a warning modal for cases where both local storage is full and the device is offline'
    ]
  },
  {
    version: '2.2.9',
    date: '2026-06-20',
    changes: [
      'Reordered the Settings drawer sections for better logical grouping',
      'Improved the "Backup & Restore" UI layout, allowing the backup and restore options to collapse independently',
      'Fixed a bug where logging out did not properly clear local data. The application now awaits the local database clearing process and immediately refreshes the page to ensure a completely fresh state',
      'Replaced the "Backup & Restore" header icon with a dedicated Database icon',
      'Extracted hardcoded UI strings in the "Development & Testing" section to English and Spanish translation files for full localization coverage'
    ]
  },
  {
    version: '2.2.8',
    date: '2026-06-20',
    changes: [
      'Updated onboarding permissions copy to reflect the new Supabase cloud architecture',
      'Compressed onboarding layout to ensure primary action buttons are visible without scrolling',
      'Added scroll-to-top behavior when navigating between views and sessions',
      'Added authenticated user profile status to the Settings Drawer',
      'Replaced hardcoded UI strings with translation keys to ensure full localization coverage'
    ]
  },
  {
    version: '2.2.7',
    date: '2026-06-19',
    changes: [
      'Added a new intelligent Sync Conflict Modal that safely handles merging or replacing conflicting local and cloud databases',
      'Fixed a bug where the Sync Conflict Modal would sometimes automatically dismiss itself due to a background sync process',
      'Fixed an issue where local offline media files were getting unintentionally erased when downloading updates from the cloud',
      'Added on-demand downloading of audio files from the cloud if they are needed for transcription and not available locally'
    ]
  },
  {
    version: '2.2.6',
    date: '2026-06-19',
    changes: [
      'Fixed a bug where sharing an untranscribed audio clip would skip the audio file',
      'Fixed missing media items count on the shared session preview screen',
      'Fixed "Restore Database" to cleanly replace cloud data instead of merging with it',
      'Fixed "Reset App Data" to completely wipe cloud storage as well as local data'
    ]
  },
  {
    version: '2.2.5',
    date: '2026-06-19',
    changes: [
      'Migrated session sharing to use Supabase cloud storage natively',
      'Audio and media files are now properly transferred when sharing sessions via the 6-digit code',
      'Removed auto-focus on import code field to improve mobile keyboard experience'
    ]
  },
  {
    version: '2.2.4',
    date: '2026-06-19',
    changes: [
      'Implemented automatic background syncing for audio and media files to Supabase Storage',
      'Added on-demand fetching for cloud media to save local device storage',
      'Fixed an issue where media uploads required navigating away from the app to sync'
    ]
  },
  {
    version: '2.2.3',
    date: '2026-06-19',
    changes: [
      'Replaced manual Google Drive sync with automatic cloud sync via Supabase using Google Sign-in',
      'Cleaned up old Google Drive backup settings, UI, and reminders',
      'Fixed a bug related to session sharing data structures causing crashes on export'
    ]
  },
  {
    version: '2.2.2',
    date: '2026-06-19',
    changes: [
      'Fixed a data race condition that could cause empty data to show temporarily after logging in',
      'Fixed an issue where the onboarding screen would incorrectly display after logging in from a fresh browser state'
    ]
  },
  {
    version: '2.2.1',
    date: '2026-06-19',
    changes: [
      'Fixed a bug causing the app loading splash screen to display briefly when navigating to the Home screen',
      'Improved the design and copy of the initial app sync loading screen'
    ]
  },
  {
    version: '2.2.0',
    date: '2026-06-19',
    changes: [
      'Implemented Supabase Local-First Sync Architecture',
      'Added cross-device data backup and synchronization',
      'Added Email/Password and Google Sign-in authentication',
      'Changed staging app logo color to Orange'
    ]
  },
  {
    version: '2.1.10',
    date: '2026-06-18',
    changes: [
      'Added Screen Wake Lock API integration to keep the phone screen awake while recording audio'
    ]
  },
  {
    version: '2.1.9',
    date: "2026-06-18",
    changes: [
      'Fixed a database write flaw causing ghost audios and disappearing sessions on some devices',
      'Added immediate error notifications if device storage runs out during session saves or recordings'
    ]
  },
  {
    version: '2.1.8',
    date: "2026-06-16",
    changes: [
      'Added the full spring-loaded brand logo animation (v29) as a celebratory transition overlay during onboarding completion and database restores'
    ]
  },
  {
    version: '2.1.7',
    date: "2026-06-16",
    changes: [
      'Replaced the default browser loading spinner with the premium, spring-loaded fidget-spinner Zoutty logo animation'
    ]
  },
  {
    version: '2.1.6',
    date: "2026-06-15",
    changes: [
      'Implemented proactive background refresh for Google Drive access tokens to prevent automatic logouts',
      'Improved the Google Drive reconnection experience with a centered modal prompt instead of an easily-missed banner'
    ]
  },
  {
    version: '2.1.5',
    date: "2026-06-15",
    changes: [
      'Added a comprehensive global Search feature allowing you to easily find content across all folders, sessions, entries, transcriptions, reports, and notes'
    ]
  },
  {
    version: '2.1.4',
    date: "2026-06-11",
    changes: [
      'Updated the Session Notes feature to use a list of editable bullet points instead of a single text area',
      'Added an inline text area with Confirm/Cancel buttons for creating new notes'
    ]
  },
  {
    version: '2.1.3',
    date: '2026-06-11',
    changes: [
      'Improved Share Session modal UX to track and display previous share states (code vs file)',
      'Added included content badges to the Share Modal to remind users what was previously shared'
    ]
  },
  {
    version: "2.1.2",
    date: "2026-06-11",
    changes: [
      "Fixed Include Media option availability when only audio clips are present",
      "Fixed iOS export bug where .zoutty.zip files were saved with a .txt extension and failed to import"
    ]
  },
  {
    version: "2.1.1",
    date: "2026-06-11",
    changes: [
      "Fixed Web Share API compatibility for exported sessions by utilizing standard zip extension",
      "Fixed an iOS bug where imported media files rendered as black previews",
      "Switched media storage entirely to Blob Mode to prevent browser permission prompts and broken gallery links"
    ]
  },
  {
    version: "2.1.0",
    date: "2026-06-11",
    changes: [
      "Added local file export/import (.zoutty) for sessions containing heavy media (audio/gallery)",
      "Hybrid sharing: text-only sessions still use 6-letter code, media sessions use file export"
    ]
  },
  {
    version: "2.0.14",
    date: "2026-06-10",
    changes: [
      "Added a changelog modal in the settings drawer",
      "Fixed include transcript toggle on session export"
    ]
  },
  {
    version: "2.0.13",
    date: "2026-06-09",
    changes: [
      "Imported sessions now keep original timestamps",
      "Fixed header width on desktop devices"
    ]
  },
  {
    version: "2.0.12",
    date: "2026-06-08",
    changes: [
      "Added share code expiration countdown",
      "Fixed online session import and imported audio clip renaming",
      "Modified session sharing system",
      "Improved export to PDF design and options (include/exclude transcripts)",
      "Removed Export to Word feature in favor of improved PDF export",
      "Added 'skip the tour' button to each onboarding step",
      "Fixed install enforcer redirection after installing"
    ]
  },
  {
    version: "2.0.11",
    date: "2026-06-07",
    changes: [
      "Updated 'Keep your data safe' modal",
      "Created pre-install guided onboarding page",
      "Improved onboarding copy and added skip/back buttons",
      "Various installation flow fixes"
    ]
  },
  {
    version: "2.0.10",
    date: "2026-06-06",
    changes: [
      "Hide Sessions section when empty",
      "Added Cloud backup info to onboarding"
    ]
  },
  {
    version: "2.0.9",
    date: "2026-06-06",
    changes: [
      "Added complete guided Onboarding (Welcome Modal, Demo Session, Empty States, Micro-Hints)",
      "Added Google Drive cloud backup integration"
    ]
  },
  {
    version: "2.0.8",
    date: "2026-06-05",
    changes: [
      "Created custom styled components",
      "Tweaked header font size"
    ]
  },
  {
    version: "2.0.7",
    date: "2026-06-05",
    changes: [
      "Fixed wrong logo colors on loading screen",
      "Added Document Export Confirmation Modal to Session pages"
    ]
  },
  {
    version: "2.0.4",
    date: "2026-06-05",
    changes: [
      "Added gallery functionality to session pages",
      "Adapted dates to app language",
      "Fixed double play icon for videos",
      "Fixed media files backup bugs"
    ]
  },
  {
    version: "2.0.2",
    date: "2026-05-26",
    changes: [
      "Improved session sharing functionality",
      "Added a timer to the recording action"
    ]
  },
  {
    version: "2.0.1",
    date: "2026-05-26",
    changes: [
      "Added Gemini-powered audio transcription, translation, and lesson consolidation",
      "Prevented the app from closing when tapping the 'back' button on phones"
    ]
  },
  {
    version: "2.0.0",
    date: "2026-05-26",
    changes: [
      "Implemented Zoutty Settings and Session Settings Drawer",
      "Added Folder Grouping and Sorting Options",
      "Added JSON Backup, Restore, and Reset functionality",
      "Implemented multi-language (i18n) support for the application UI"
    ]
  }
];
