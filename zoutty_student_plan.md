# Zoutty → Personal Learning Memory for Dancers
## Implementation Roadmap

**Strategic direction**: Evolve Zoutty from a teacher-facing note tool into a **student-first personal learning memory**. The core loop becomes: *Bring my lesson → Zoutty processes it → save it → understand it → find it again later.*

This is an **evolution**, not a rewrite. Essentially all existing functionality (transcription, AI consolidation, sharing, sync, billing) is preserved. We are changing the front door and adding a memory layer on top.

---

## Codebase Snapshot (What Already Exists)

After inspecting the codebase thoroughly, here is what we can reuse:

| Layer | Current state |
|---|---|
| **Data model** | `Session` (title, subtitle, date, notes, summary, glossaryId, groupId, shareId, sharedContent) stored in IndexedDB + Supabase |
| **Audio clips** | `AudioEntry` (transcript, strictSummary, expandedInsights, audioBlob) |
| **AI pipeline** | `/api/gemini/process-single-audio` (transcription) + `/api/gemini/process-audio` (consolidation to report) — both working |
| **Video support** | `audioExtractor.ts` already extracts 16kHz mono WAV from any video file; `sessionMedia` already stores video files in gallery |
| **Sync** | Full IndexedDB ↔ Supabase sync engine with pending_sync flags |
| **Search** | `search.ts` performSearch across sessions, audios, reports, media |
| **Session list** | Flat list + folder groups with sorting. view = `'list' | 'detail'`. Navigation via `navigateTo()` |
| **Billing** | Student / Teacher tiers via Stripe, unchanged |
| **Sharing** | Share codes + file export, working |
| **i18n** | EN + ES via `t()` |

**Key gaps** that need to be built:
1. No chronological "Lesson History" home view
2. No "New Session" entry point screen (currently creates blank session immediately)
3. Video upload doesn't keep the original video AND extract audio simultaneously — it only extracts audio and discards the video
4. No AI-generated tags/topics on sessions
5. No cross-session topic intelligence

---

## Branching Strategy

> **Before starting any work: create `feature/student-evolution` from `feature/production-launch` (current HEAD).**

```
feature/production-launch  ← current working version (stays stable)
        │
        └──► feature/student-evolution  ← all phases developed here
```

**Rule**: `feature/production-launch` is never touched during this work. When the evolution is stable, we merge `student-evolution` → `production-launch`.

Each phase is a sequence of commits on `student-evolution`. No sub-branches per phase needed unless a phase is very large.

---

## Phase Overview

| Phase | Name | Priority |
|---|---|---|
| 1 | **Lesson History + New Session Entry Point** | MVP / Essential |
| 2 | **Video as Primary Input** | MVP / Essential |
| 3 | **AI-Generated Tags** | MVP / Essential |
| 4 | **Topic Intelligence (cross-session patterns)** | Later / Future |

---

## Phase 1 — Lesson History + New Session Entry Point

### What we are changing
- The **home screen** becomes a **chronological learning journal** (Lesson History), not a flat session list.
- The existing session list + folders becomes a secondary view called **"Library"**.
- The **"New Session"** button opens a small entry point screen instead of immediately creating a blank session.

### Why it needs to happen
The flat session list doesn't communicate "learning over time." The first thing a student should feel when opening Zoutty is: *"I can see everything I've learned."* This repositioning is the highest-leverage change for the new direction and requires no data model changes.

### User experience

**Home (Lesson History) — new primary view:**
```
┌─ September 2026 ────────────────────────────────┐
│                                                  │
│  Sep 8 · Private lesson                         │
│  ● Weight transfer  ● Connection  ● Turns        │
│                                                  │
│  Sep 2 · Class                                   │
│  ● Musicality  ● Footwork                        │
│                                                  │
└──────────────────────────────────────────────────┘
┌─ August 2026 ───────────────────────────────────┐
│  Aug 28 · Private lesson                        │
│  ...                                            │
└──────────────────────────────────────────────────┘
```

Sessions are grouped by month (using `session.date`). Each card shows:
- Date (formatted short: "Sep 8")
- Session subtitle (editable, e.g. "Private lesson with Olaya") — for now the student fills this manually
- Tags/topic chips (placeholder in Phase 1, populated in Phase 3)
- A small indicator if a processed AI report exists

No folders are shown in Lesson History. The month grouping replaces the folder concept for chronological navigation.

**Library view — secondary:**
The current home screen (folder groups + session list + sort controls) becomes a second panel called "Library" or "All Sessions." A toggle/tab between History and Library appears at the top of the home screen.

**New Session entry point:**
Instead of instantly creating a blank session, tapping "New Session" (or a "+" FAB) opens a small bottom sheet or modal:

```
Add a lesson
─────────────────────────────
📹  Upload video             ›
🎵  Upload audio             ›
🎙️  Record now               ›
📝  Start blank              ›
```

On selecting an option, Zoutty creates the session and opens it, with the appropriate flow pre-triggered (file picker, mic, or just the empty session).

### Affected existing functionality
- The `view` state machine currently has `'list' | 'detail'`. We add a home-level tab state (`'history' | 'library'`) managed separately.
- The existing session list rendering code stays intact (it becomes the Library view).
- `createSession()` stays unchanged — we just add a new entry point screen before calling it.
- All sorting, search, folder management stays in the Library view.

### What needs to be implemented
1. **`HistoryView` component** — grouped by month, renders session cards with date, subtitle, and tag chips (empty in Phase 1). Lives inside `App.tsx` or a dedicated component file.
2. **Home tab toggle** — "Lesson History" | "Library" tabs/buttons at the top of the home view. Persisted to localStorage as `zoutty_home_tab`.
3. **`NewSessionEntryModal`** component — bottom sheet with 4 options. Replaces the direct `createSession()` call from the "+" button.
4. **i18n keys** — all new text in `en.ts` and `es.ts`.
5. **Onboarding update** — the interactive onboarding steps must reflect the new entry point if they reference the "+" button.

### Dependencies
- No previous phases required.
- No database schema changes needed.
- No server changes needed.

### How to test
1. Home screen shows "Lesson History" by default, sessions grouped by month.
2. Switching to "Library" shows the current list/folder view exactly as before.
3. Tapping "+" opens the entry modal with 4 options.
4. Selecting "Start blank" creates a session and opens it (existing behavior).
5. Selecting "Record now" creates a session, opens it, and triggers the microphone (existing behavior).
6. Selecting "Upload audio" creates a session, opens it, and opens the file picker (existing behavior).
7. All existing session management (rename, delete, move, share, search) still works from the Library view.

### Done when
- History view is the default home screen.
- Library view is accessible and contains all existing session management.
- New Session entry point works for all 4 options.
- All text uses `t()` keys (no hardcoded strings).
- EN + ES translations complete.

---

## Phase 2 — Video as Primary Input

### What we are changing
When a student uploads a video, Zoutty now **does two things**:
1. Stores the original video as a **Gallery media item** (so the student can watch it later).
2. **Auto-extracts the audio** and creates an audio clip for AI processing.

Previously, the video was discarded after audio extraction. Now it is preserved.

The **"Upload video"** option in the Phase 1 entry point modal is the primary trigger for this flow.

### Why it needs to happen
The teacher-records-a-recap-video scenario is the strongest use case. The student should be able to: upload the video → watch it anytime → have Zoutty automatically generate the structured lesson record. Currently the video is lost after extraction.

### User experience

When a student selects **"Upload video"** from the entry point:
1. File picker opens (accepts `video/*`).
2. Zoutty creates a new session.
3. A progress indicator shows: *"Processing your video..."*
4. Behind the scenes simultaneously:
   - The original video file is saved to the Gallery (`sessionMedia` store) with `storageMode: 'blob'` and synced to Supabase Storage.
   - The audio is extracted (`extractAudioFromVideo`) and saved as an `AudioEntry` (existing flow).
5. The student is taken to the session detail view.
6. They see: the video in the Gallery section (playable), and the audio clip in the Audio Clips section.
7. A prominent "Process with AI" button (or auto-trigger) initiates transcription + consolidation.

**Video duration limit**: 3 minutes (same as all clips). Videos longer than 3 minutes → the existing `AudioDurationExceededModal` is shown (same UX as today for audio).

**Within an existing session**: the same behavior applies when a student taps "Add video" inside a session detail. The video is stored in Gallery AND audio is extracted.

### Affected existing functionality

**Current behavior** (to change):
- [`handleFileUpload`](file:///c:/Projects/zoutty/src/App.tsx#L2204-L2244): when a video file is detected, `extractAudioFromVideo()` runs, then `addAudioEntry()` is called. The original video file is then **discarded**.

**New behavior**:
- Same extraction happens, but BEFORE discarding the file, we also call `handleAddMediaItem()` (the gallery save function) with the original video file.
- This requires the gallery save function to be callable programmatically (it currently requires user interaction via a file picker).

**New server-side endpoint** (optional): None required. The Gallery already syncs video blobs to Supabase Storage via the existing `syncEngine`. No server changes needed.

### What needs to be implemented

1. **Modify `handleFileUpload`** — after extracting audio from a video, also save the original video file to `sessionMedia` (Gallery). The video file goes in as `storageMode: 'blob'` (Safari/mobile compatible).
2. **Modify the Gallery "Add media" handler** — expose it as a callable function so the entry point modal can also trigger it programmatically (not only from a file input).
3. **Entry point "Upload video" option** — creates session, then opens video file picker and triggers the dual-save flow.
4. **Progress UX** — the spinner text should say something like *"Processing your video…"* while extraction + gallery save happen.
5. **i18n keys** for new toast/spinner messages.

### Dependencies
- Requires Phase 1 (entry point modal must exist so "Upload video" can be the trigger).

### How to test
1. From entry modal, select "Upload video" → pick a video file ≤3 min.
2. Session opens. Gallery section contains the original video (playable). Audio Clips section contains the extracted WAV.
3. Process the audio clip with AI → consolidated report generates normally.
4. Session is shared → video is accessible via the Supabase Storage URL (existing share system handles this).
5. Test with a video > 3 min → duration exceeded modal appears, nothing is saved.
6. Test from within an existing session (the existing upload button) → same dual-save behavior.

### Done when
- Uploading a video keeps the original video in Gallery AND creates an audio clip automatically.
- The 3-minute limit applies and is enforced.
- Gallery video is playable in the lightbox (existing video player).
- The audio clip can be processed with AI normally.
- Sync to Supabase Storage works for both the video (Gallery) and the WAV (audios bucket).

---

## Phase 3 — AI-Generated Tags

### What we are changing
When a session is processed (the "Consolidate" button), the AI now also returns **topic tags** for the session. These tags are automatically added to the session and displayed as chips in the Lesson History view.

Tags are also manually editable by the user.

### Why it needs to happen
Tags make the Lesson History meaningful. Without them, history cards show a date and a subtitle — useful, but not instantly revealing *what was learned*. Tags turn the history into a genuine learning record: "Sep 8 → weight transfer, connection, turns."

This also lays the foundation for Phase 4 (cross-session intelligence) without requiring any architectural changes at that point.

### User experience

After AI consolidation runs on a session:
- The session gains 3–6 topic tags (e.g. `weight transfer`, `connection`, `turns`, `musicality`).
- Tags appear as chips in the Lesson History card for that session.
- Inside the session detail, a "Topics" section shows the tags as editable chips.
- The user can: **delete a tag** (tap X on chip), **add a tag manually** (small text input + add button).
- Changes to tags save immediately (same pattern as editing notes).

### Data model change

Add `tags?: string[]` to the `Session` type in [`src/types.ts`](file:///c:/Projects/zoutty/src/types.ts).

Add `tags text[]` column to the `sessions` Supabase table (SQL migration).

The `tags` field syncs automatically via the existing sync engine (it's a simple array on the session object, just like `cardOrder`).

> **IndexedDB version bump**: DB_VERSION goes from 4 → 5 in [`src/lib/db.ts`](file:///c:/Projects/zoutty/src/lib/db.ts) — but no new object store is needed (tags are stored on the session object itself).

### AI prompt change

In [`server.ts`](file:///c:/Projects/zoutty/server.ts), the `consolidateTranscriptsWithGemini` function currently returns:
```json
{
  "strictSummary": [...],
  "expandedInsights": { "drills": [...], "homework": [...], ... }
}
```

We extend the prompt to add a `tags` field:
```json
{
  "strictSummary": [...],
  "expandedInsights": { ... },
  "tags": ["weight transfer", "connection", "turns"]
}
```

Prompt addition: *"tags: Extract 3-8 concise topic labels representing the main dance concepts discussed in this lesson. Use simple English noun phrases (e.g. 'weight transfer', 'connection', 'turns'). These will be used to tag the lesson for future reference."*

The server returns `tags` in the `/api/gemini/process-audio` response. The client saves them onto the session via `updateSession()`.

### Affected existing functionality

- [`handleConsolidate()`](file:///c:/Projects/zoutty/src/App.tsx#L2246) — after receiving the report result, also extract `tags` from the response and call `updateSession(session.id, { tags: result.tags })`.
- [`FinalReport`](file:///c:/Projects/zoutty/src/types.ts#L81) type — no change; tags live on the Session, not the FinalReport.
- The existing mock mode in `/api/gemini/process-audio` should also return mock tags.

### What needs to be implemented

1. **`Session` type** — add `tags?: string[]` field.
2. **Supabase migration** — `ALTER TABLE sessions ADD COLUMN tags text[];`
3. **Server prompt** — add `tags` to the consolidation prompt JSON schema.
4. **`handleConsolidate()` client** — extract and save tags from the API response.
5. **Tags UI in session detail** — "Topics" section with chip display, add/delete functionality.
6. **Tags chips in Lesson History cards** — render `session.tags` as small colored chips on the history feed card.
7. **i18n keys** for all new UI text.

### Dependencies
- Requires Phase 1 (Lesson History must exist to display tags there).
- Phase 2 is not strictly required for tags, but they work together (process video → get tags).

### How to test
1. Create a session, upload a video/audio, run consolidation.
2. Session receives tags from AI (3–8 chips displayed).
3. Tags appear in Lesson History card for that session.
4. User can delete a tag → chip disappears, session saved.
5. User can add a manual tag → chip appears, session saved.
6. Tags persist across reload (synced to Supabase).
7. Tags appear correctly in both EN and ES.

### Done when
- AI auto-generates tags on consolidation.
- Tags are editable by the user.
- Tags appear in Lesson History cards.
- Tags sync to cloud.
- Mock mode returns sample tags.

---

## Phase 4 — Topic Intelligence (Future)

### What we are changing
The Lesson History view gains a new surface: **"What have I been working on?"** — a cross-session view of topics, showing how often each tag appears and when it was last practiced.

### Why it needs to happen (later)
This is the "learning memory" layer that makes Zoutty increasingly valuable over time. It enables questions like: *"When did I last work on connection? Which topics have I focused on most?"*

**This is deliberately out of scope for the initial MVP**. We are designing Phases 1–3 to not block this — tags are stored on sessions from Phase 3, which is exactly the data needed here.

### Planned user experience

A new "Topics" tab or section accessible from the Lesson History view:

```
Topics
─────────────────────────────────
Connection          6 sessions  ▸
Weight Transfer     4 sessions  ▸
Turns               3 sessions  ▸
Musicality          2 sessions  ▸
─────────────────────────────────
```

Tapping a topic shows all sessions tagged with it, in chronological order.

A **"Last worked on"** indicator per tag: *"3 weeks ago"*.

### What needs to be implemented (when we get there)
- **Topics screen**: aggregate `sessions.tags` in memory (or via Supabase query), compute frequency + recency.
- **Tag → session list**: filter sessions by tag, show in history card format.
- **No new data model needed** — tags from Phase 3 are sufficient.

### Dependencies
- Requires Phase 3 (tags must exist).
- No server changes needed (all computation is client-side aggregation of existing data).

---

## What We Are NOT Doing

| Item | Decision |
|---|---|
| Renaming pricing tiers | Not now — revisit after UX evolution |
| New database entities for teacher/lesson type/location | Not needed — subtitle + notes cover this for now |
| AI assistant / Q&A interface ("What should I practice?") | Future — Phase 4+ |
| Removing teacher features | No — teachers can still use Zoutty; they just aren't the primary audience |
| Rewriting the sync engine | Unchanged |
| Changing the sharing system | Unchanged |
| Calendar grid view | Not in plan — month-grouped feed is sufficient and mobile-friendly |

---

## Technical Architecture Summary

### No new database tables needed for Phases 1–3
- Phase 1: pure UI changes.
- Phase 2: dual-save to existing `sessionMedia` + `audios` tables.
- Phase 3: one new column (`tags text[]`) on existing `sessions` table.

### No new server routes needed for Phases 1–3
- Phase 2: no new endpoints; existing storage sync handles video blobs.
- Phase 3: the existing `/api/gemini/process-audio` endpoint gets a prompt update to return tags.

### IndexedDB version bump
- Phase 3 triggers DB_VERSION 4 → 5 (tags on Session, no new store).

### Files primarily affected

**Phase 1:**
- [`src/App.tsx`](file:///c:/Projects/zoutty/src/App.tsx) — new History view component, Library tab toggle, NewSession entry modal
- [`src/i18n/en.ts`](file:///c:/Projects/zoutty/src/i18n/en.ts) + [`es.ts`](file:///c:/Projects/zoutty/src/i18n/es.ts)
- New component file: `src/components/NewSessionEntryModal.tsx`

**Phase 2:**
- [`src/App.tsx`](file:///c:/Projects/zoutty/src/App.tsx) — modify `handleFileUpload` to dual-save video
- [`src/i18n/en.ts`](file:///c:/Projects/zoutty/src/i18n/en.ts) + [`es.ts`](file:///c:/Projects/zoutty/src/i18n/es.ts)

**Phase 3:**
- [`src/types.ts`](file:///c:/Projects/zoutty/src/types.ts) — add `tags?: string[]` to Session
- [`src/lib/db.ts`](file:///c:/Projects/zoutty/src/lib/db.ts) — DB_VERSION bump
- [`server.ts`](file:///c:/Projects/zoutty/server.ts) — extend consolidation prompt + response
- [`src/App.tsx`](file:///c:/Projects/zoutty/src/App.tsx) — extract + save tags on consolidation, tags UI
- Supabase SQL: `ALTER TABLE sessions ADD COLUMN tags text[];`
- [`src/i18n/en.ts`](file:///c:/Projects/zoutty/src/i18n/en.ts) + [`es.ts`](file:///c:/Projects/zoutty/src/i18n/es.ts)

---

## Verification Plan

### Per phase
Each phase ends with the server running at `localhost:8181` and a manual walkthrough of:
1. The new user-facing feature (happy path).
2. The preserved existing behavior (regression check).
3. Sync verification (create session → check Supabase dashboard).
4. Both EN and ES language modes.

### Build check
`npm run build` must complete without TypeScript errors after each phase.

### Rollback
If a phase introduces a critical regression: `git revert` the phase commits. `feature/production-launch` is untouched throughout.

---

## Open Questions (Resolved During Grill Session)

All design decisions are confirmed:

| Question | Decision |
|---|---|
| Video upload UX | Keep original video in Gallery + extract audio automatically |
| Session metadata (teacher, etc.) | Use existing subtitle/notes manually; no new DB fields |
| Home view | Lesson History as default home; Library as secondary tab |
| Tag generation | AI auto-suggests via existing consolidation endpoint; user-editable |
| Branching | `feature/student-evolution` from `feature/production-launch` |
| Navigation labeling | "Lesson History" + "Library" |
| Session creation flow | Entry point modal with 4 options |
| Pricing tiers | Unchanged for now |
| Tags display | Chips on Lesson History feed cards |
| Video limits | 3-minute max (same as audio) for both processing and gallery |
| Phase order | 1 History/Entry → 2 Video → 3 Tags → 4 Topics Intelligence |
