export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
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
