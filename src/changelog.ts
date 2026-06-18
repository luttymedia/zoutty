export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '2.1.9',
    date: new Date().toISOString().split('T')[0],
    changes: [
      'Fixed a database write flaw causing ghost audios and disappearing sessions on some devices',
      'Added immediate error notifications if device storage runs out during session saves or recordings'
    ]
  },
  {
    version: '2.1.8',
    date: new Date().toISOString().split('T')[0],
    changes: [
      'Added the full spring-loaded brand logo animation (v29) as a celebratory transition overlay during onboarding completion and database restores'
    ]
  },
  {
    version: '2.1.7',
    date: new Date().toISOString().split('T')[0],
    changes: [
      'Replaced the default browser loading spinner with the premium, spring-loaded fidget-spinner Zoutty logo animation'
    ]
  },
  {
    version: '2.1.6',
    date: new Date().toISOString().split('T')[0],
    changes: [
      'Implemented proactive background refresh for Google Drive access tokens to prevent automatic logouts',
      'Improved the Google Drive reconnection experience with a centered modal prompt instead of an easily-missed banner'
    ]
  },
  {
    version: '2.1.5',
    date: new Date().toISOString().split('T')[0],
    changes: [
      'Added a comprehensive global Search feature allowing you to easily find content across all folders, sessions, entries, transcriptions, reports, and notes'
    ]
  },
  {
    version: '2.1.4',
    date: new Date().toISOString().split('T')[0],
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
    date: new Date().toISOString().split('T')[0],
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
