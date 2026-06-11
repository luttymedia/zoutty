export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: "2.1.1",
    date: new Date().toISOString().split('T')[0],
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
