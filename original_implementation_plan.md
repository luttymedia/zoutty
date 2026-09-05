# Zoutty Post-Testing Implementation Plan

This plan consolidates all 41 feedback comments plus the 6 feature requests from the prompt into prioritised, ordered phases. Items are grouped by theme and dependencies, so each phase can be executed independently without breaking work from previous phases.

---

## Scope Summary

- **41 test feedback comments** (from `zoutty_testing_feedback.json`)
- **6 requested features/changes** (from the user's prompt)

---

## Open Questions

> [!IMPORTANT]
> Please answer these before we start execution, as the answers affect scope and design:

1. **Comment #6 — Render logs**: No Render logs appear unless Gemini is called. Is the logging level configured in Render's environment? This might just be a Render dashboard filter issue, not a bug. *Do you want us to investigate?*

2. **Comment #10 — Sessions not appearing in Supabase**: You believe it was a hiccup and noted it resolved itself. *Do you want us to add defensive sync retry logic, or treat this as a "monitor it" item for now?*

3. **Comment #13 — Double API call on cancel-then-retry**: The server endpoint has no cancellation support (the `AbortController` on the client only prevents the UI from waiting, but the server-side Gemini call may already be in-flight). *Do you want us to implement a server-side abort/idempotency mechanism?*

4. **Comment #15 — Media deletion from Supabase Storage**: When a user deletes an audio clip or gallery media, should the raw file be deleted from the Supabase `sessionMedia` storage bucket immediately, or only at account deletion? *Immediate deletion is preferred from a GDPR/cost perspective — confirm?*

5. **Comment #39 — Referral boost (Free plan, Tests 2 & 3)**: The quota counter doesn't update when a referral completes past the 14-day refund window. *Is the root issue that the frontend reads the quota from a cached profile snapshot and doesn't refresh after the referral event fires?*

6. **Comment #39 — Student plan discount display (Test 4)**: After all referral discounts are consumed, the "Refer a Friend" modal still shows "€3 available". *Is the source of truth for this the Stripe coupon/discount objects, or Supabase `referral_credits_balance`?*

7. **Glossary redesign**: The prompt asks for a full rework of global vs. session glossaries, pre-filling a comprehensive list, and allowing per-session selection. *Do you want us to scope this out as a full redesign in this plan, or treat it as a separate future spec?* (Marked as Phase 5 for now — low priority.)

8. **User display name**: When signing up with email, should we add a "Display name" field to the signup form, and store it in `profiles.display_name`? Does the `profiles` table already have that column, or do we need to add it via a migration?

---

## Phase 1 — Critical Bug Fixes (Blocking / Broken UX)
*These are showstoppers or significantly broken features.*

---

### 1a. Stripe Subscription Lifecycle Bugs (Comments #30–#35)

> [!CAUTION]
> These bugs mean subscription cancellations and downgrades are not reflected in the app. Users who cancel via the Stripe portal stay on paid tiers indefinitely.

**Root causes identified:**

- `customer.subscription.deleted` IS handled (`server/stripe.ts:588`), but Stripe's default "cancel at period end" flow does NOT fire this event immediately — it fires `customer.subscription.updated` with `cancel_at_period_end: true` first, and only fires `customer.subscription.deleted` at the end of the billing period.
- The `customer.subscription.updated` handler (`server/stripe.ts:550`) reads `cancel_at_period_end` and saves it to Supabase, but the **UI does not reflect this** — it doesn't show a "cancels on [date]" message, and doesn't downgrade the user visually at period end.
- **Downgrade flow** (`ManageSubscriptionModal`): Does it call a direct Supabase update instead of redirecting to Stripe Portal? This is the correct flow for mid-period upgrades (Stripe handles proration), but needs investigation.

**Fixes:**
- **[INVESTIGATE FIRST]** Review `ManageSubscriptionModal.tsx` downgrade/cancel handlers to understand if they bypass Stripe Portal.
- Fix the webhook handler: when `cancel_at_period_end = true`, show a "Cancels on [date]" indicator in the UI (read `current_period_end`).
- The downgrade flow must redirect to Stripe Portal (create a portal session), not modify Supabase directly.
- Cancel flow from UI should redirect to Stripe Portal, not do anything locally.
- Add `customer.subscription.updated` handling when `status` is `canceled`, `past_due`, or `unpaid` → downgrade user profile.
- Add `invoice.payment_failed` webhook handler → mark user as `past_due` and show a banner.

**Files:**
- `server/stripe.ts` — webhook handler
- `src/components/ManageSubscriptionModal.tsx` — downgrade/cancel CTA
- `src/App.tsx` — subscription status display in settings

---

### 1b. Double Referral Log Rows (Comment #5)

> [!CAUTION]
> Two referral_log rows are created for the same signup event. This could double-count rewards.

**Root cause:** `server.ts` → `/api/referrals/redeem` may be called twice from the frontend (e.g., both on email confirmation callback and on the initial signup page). Or `redeemReferralCode()` lacks an idempotency check.

**Fixes:**
- **[INVESTIGATE FIRST]** Trace where `redeemReferralCode` is called in the frontend — look for double triggers (e.g., both `onAuthStateChange` and a manual call after signup).
- Add a unique constraint on `(referred_user_id)` in `referral_logs` (a user can only be referred once), or add an idempotency guard in `redeemReferralCode()`.

**Files:**
- `server/referrals.ts` — `redeemReferralCode()`
- `src/App.tsx` / `src/components/AuthScreen.tsx` — where redeem is called

---

### 1c. Glossary Section Unresponsive (Comments #14 & #26)

> [!CAUTION]
> The entire Custom Glossaries section in Settings is unresponsive. No testing was possible.

**Root cause:** [TBD from investigation — likely a missing event handler, wrong state, or an `onClick` on a disabled element.]

**Fixes:**
- **[INVESTIGATE FIRST]** Open `App.tsx` glossary section in the settings drawer, find what the "Add glossary" button does, and trace why clicks don't respond.
- Fix the handler.
- This is a prerequisite for Phase 5 (Glossary Redesign).

**Files:**
- `src/App.tsx` — glossary section in settings
- `src/i18n/en.ts` / `es.ts`

---

## Phase 2 — UX / Flow Bugs (Non-Blocking but Impactful)

---

### 2a. Settings Drawer — Modal Close Navigation (Comment #22)

When modals opened from Settings (Upgrade Plan, Manage Subscription, Top-Up, Refer a Friend, Sign In/Sign Up, Log Out) are closed, they navigate to the home screen instead of returning to the settings drawer.

**Fix:** Each modal's `onClose` callback should call `setShowAppSettings(true)` to re-open the settings drawer, not just `setShowModal(false)`.

**Files:**
- `src/App.tsx` — all `setShowAppSettings` calls on modal close
- Affects: `PricingModal`, `ManageSubscriptionModal`, `QuotaExceededModal`, `ReferralModal`, Auth flow close

---

### 2b. Share Modal — Height & Scroll (Comment #18)

The share modal is too tall for mobile screens.

**Fix:** Add `max-h-[90vh] overflow-y-auto` (or similar) to the share modal's container.

**Files:**
- `src/App.tsx` — share modal JSX (search for `shareModal` state rendering)

---

### 2c. Share Modal — "Include Media" Warning Triggers Incorrectly (Comment #19)

The "Heavy media selected" warning appears even when the session has only a short audio clip and consolidated notes (no media).

**Root cause found:** Line 4225 in `App.tsx`:
```tsx
const hasMedia = sessionMedia.length > 0 || hasAudios;
```
`sessionMedia` is the **global** array for all sessions, not filtered for the current session. If any other session has media, this is `true`.

**Fix:** Filter `sessionMedia` to the current session:
```tsx
const hasMedia = sessionMedia.filter(m => m.sessionId === selectedSession.id).length > 0 || hasAudios;
```
Also, the warning should only trigger at a meaningful threshold (e.g., >5 media files, or total size > Xmb), not just because audio exists. This needs a clearer definition of "heavy media."

**Files:**
- `src/App.tsx` — line ~4225

---

### 2d. Search — "Has Gallery Items" Filter Broken (Comment #21)

The filter logic in `src/lib/search.ts:87` looks correct — it checks `sessionToMediaCount.get(session.id)`. The likely bug is in how `sessionMedia` is loaded or passed to `performSearch`.

**Root cause:** [INVESTIGATE] Is `sessionMedia` populated at the time the search runs? The state may be empty if media hasn't been loaded for all sessions (it's probably only loaded for the currently open session).

**Fix:** Ensure `sessionMedia` contains data for all sessions before search runs, OR load it on demand within `performSearch`.

**Files:**
- `src/App.tsx` — `handleSearchConfirm` and `sessionMedia` loading
- `src/lib/search.ts` — no changes expected

---

### 2e. Referral Share Link Duplicated (Comment #38)

The shared WhatsApp message contains the URL twice: one without trailing slash, one with.

**Root cause:** The share text probably concatenates `t('referral.shareText')` + `url`, but the translation key `billing.plans.shareText` ends with a space and the URL is also appended by the `navigator.share` API's `url` field separately.

**Fix:** Ensure the share payload either uses `text` OR `url` in `navigator.share`, not both with the URL embedded in the text. Deduplicate the URL in the share text.

**Files:**
- `src/components/ReferralModal.tsx` — share button handler

---

### 2f. Backup/Restore Modal Buttons Not Centered (Comment #25)

The Cancel / Merge / Replace buttons are left-aligned instead of centered.

**Fix:** Add `justify-center` or `text-center` to the button container.

**Files:**
- `src/App.tsx` — Backup/Restore confirm modal JSX

---

### 2g. Multiple Files — Only First Oversized File Flagged (Comment #12)

When uploading 5 files (2 over 3 min), only the first oversized file is flagged; the second is silently dropped.

**Root cause:** `AudioDurationExceededModal` only stores a single `{ duration, filename }`. When a second oversized file is found, it overwrites the first modal state and the first modal is never shown.

**Fix:** 
- Change `showDurationExceededModal` state to hold an **array** of oversized files.
- Update `AudioDurationExceededModal` to list all flagged files.
- Or show the modal for all rejected files at once.

**Files:**
- `src/App.tsx` — `handleFileUpload` (~line 1881), `showDurationExceededModal` state
- `src/components/AudioDurationExceededModal.tsx` — accept array of files

---

### 2h. Quota Reset Date Incorrect (Comment #23)

Currently shows "today + 30 days" instead of the actual Stripe `current_period_end`.

**Root cause:** The settings drawer hardcodes a 30-day estimate instead of reading `profile.current_period_end`, which IS saved to Supabase by the `customer.subscription.updated` webhook handler (line 581 in `server/stripe.ts`).

**Fix:** In the settings drawer, read `devState.current_period_end` (or equivalent profile field) and display it formatted.

**Files:**
- `src/App.tsx` — "Resets on" date in Plan & AI Quota section

---

### 2i. QuotaExceededModal — Plan Click Goes to PricingModal (Comment #29)

Clicking a plan in `QuotaExceededModal` opens `PricingModal` instead of going directly to Stripe checkout.

**Fix:** The `onUpgradeClick` in `QuotaExceededModal` should trigger Stripe checkout directly (like `handleOpenCheckout(tier)`), not open `PricingModal`.

**Files:**
- `src/App.tsx` — line ~3351 (`setShowPricingModal(true)` → replace with direct checkout)
- `src/components/QuotaExceededModal.tsx` — possibly pass tier to the callback

---

### 2j. Top-Up — Add Pre-Checkout Explanation Modal (Comments #24 & #36)

Before redirecting to Stripe top-up checkout, show a modal explaining what top-ups are (cost, credits, non-refundable, etc.).

**Fix:** Create a new `TopUpInfoModal` component. When user clicks "Top Up" (both from Settings and QuotaExceededModal), open this modal first. The modal's CTA triggers the actual checkout.

**Files:**
- `src/components/TopUpInfoModal.tsx` — [NEW]
- `src/App.tsx` — replace direct top-up checkout calls
- `src/i18n/en.ts`, `es.ts` — new translation keys

---

### 2k. QuotaExceededModal for Paid Tiers — Too Tall (Comment #36)

The modal doesn't fit mobile screens.

**Fix:** Add `max-h-[90vh] overflow-y-auto` to the modal container.

**Files:**
- `src/components/QuotaExceededModal.tsx`

---

## Phase 3 — Visual / Polish Bugs

---

### 3a. Guest Mode — Remove Logout Description Text (Comment #3)

In guest mode, the settings drawer shows "Log out of Zoutty Cloud. This will clear..." text above the Guest User card. This is misleading.

**Fix:** Wrap the logout description paragraph (line ~2994) in a condition: `{!isGuestMode && (<p>...)}`

**Files:**
- `src/App.tsx` — line ~2994

---

### 3b. Header Subtitle Hidden on Mobile (Comment #8)

"Private Lesson Companion" subtitle doesn't show on mobile because of `hidden sm:block` class.

**Fix:** Decide: either always show it (remove `hidden`, use smaller font on mobile), or keep it hidden but noted as intentional. Since this is a UX note rather than a critical bug, the recommendation is to **keep it hidden on mobile** (the header is already cramped) and update the checklist note. However, if you want it visible, change `hidden sm:block` to `block`.

**Files:**
- `src/App.tsx` — line ~4164 (per your preference)

---

### 3c. Audio Player — Duration & Playhead Rendering (Comment #11)

The audio player doesn't show total duration, and the playhead jumps to near-end before settling.

**Root cause:** [INVESTIGATE] How is the waveform's duration calculated? The `<audio>` element's `duration` is `Infinity` or `NaN` for certain encoded formats until the audio is fully buffered.

**Fix:** Load the audio URL and wait for `loadedmetadata` event to update duration. For seek bar: don't render the playhead until `readyState >= 2`.

**Files:**
- `src/App.tsx` — `AudioEntryCard` component (~line 6233)

---

### 3d. Drag Handles Not Visible (Comment #16)

In reorder mode, no grip icons appear on individual cards. The entire card becomes draggable, but there's no visual affordance.

**Root cause:** `SortableCard` applies drag listeners to the whole card div, but doesn't render a visible grip icon inside each card.

**Fix:** Add a visible `GripVertical` icon handle to each card in reorder mode. Use the drag handle approach: move `listeners` to the handle element only, and apply `{...attributes}` to the card container.

**Files:**
- `src/App.tsx` — `SortableCard` component (~line 5831) and `AudioEntryCard` (~line 6233)

---

### 3e. Touch Sensor — Card Drags Without 250ms Hold (Comment #17)

Even though the `TouchSensor` has `delay: 250`, cards move immediately.

**Root cause:** The `PointerSensor` with `distance: 8` also fires on touch events (on many devices, pointer events fire for touch). The `TouchSensor` delay is bypassed because `PointerSensor` activates first.

**Fix:** Add `activationConstraint: { distance: 8 }` only for mouse (use `PointerSensor` with a mouse-only filter), or exclude touch events from `PointerSensor`. Alternatively, use the `delay` constraint on `PointerSensor` as well, but only on mobile.

**Files:**
- `src/App.tsx` — `useSensors` configuration (~line 6169)

---

### 3f. Install Wall — "Preparing installation…" Text Doesn't Disappear (Comment #1)

The text persists on both `/` and `/onboarding.html` after install.

**Root cause:** [INVESTIGATE] In `public/onboarding.html` (~line 678), `hintAndroidPreparing` is set but there's likely no cleanup step that removes/hides the hint text after the install prompt is resolved or dismissed.

**Fix:** Ensure the hint element is hidden after the `appinstalled` event fires OR after the install prompt is accepted/dismissed.

**Files:**
- `public/onboarding.html` — install prompt hint logic

---

### 3g. Logo Animation Not Playing on First Launch (Comment #7)

Even after clearing all data, the logo animation doesn't play.

**Root cause:** [INVESTIGATE] `setLogoAnimationType('onboarding')` is likely conditional on some localStorage flag. After a fresh clear, the condition might not be set or might be evaluated before state is ready.

**Fix:** Trace `logoAnimationType` initialization. Ensure the onboarding animation is triggered when no prior data exists.

**Files:**
- `src/App.tsx` — logo animation trigger logic (~where `logoAnimationType` is set)

---

### 3h. Dev & Testing Settings Section Cleanup (Comment #28)

The "Dev & Testing" section in Settings has "Gemini mock mode" and "Test lab & dev tools" buttons that normal users should not see. The Mock Mode button is already accessible via the lab icon in the header.

**Fix:** 
- Rename the section (e.g., "Other").
- Remove "Gemini Mock Mode" and "Test Lab & Dev Tools" buttons from the section.
- Keep "Replay Onboarding" and "Refer a Friend" (and any other user-facing items).

**Files:**
- `src/App.tsx` — settings drawer "Dev & Testing" section

---

### 3i. Offline Usage Guide — Incorrect Text (Comment #27)

The guide says "AI transcriptions will automatically consolidate" which is incorrect — nothing auto-processes.

**Fix:** Update the translation key to remove the incorrect statement.

**Files:**
- `src/i18n/en.ts`, `es.ts` — `appSettings.offlineGuide3` (or similar key)

---

## Phase 4 — New Features

---

### 4a. Delete Account Feature

Add a "Delete Account" button in the Settings drawer (below the logout button) with:
- A confirmation modal explaining what is deleted (data, subscriptions, etc.)
- Server endpoint to: cancel Stripe subscription → delete Supabase auth user → delete all user data

**Files:**
- `src/App.tsx` — settings drawer account section + new modal state
- `src/components/DeleteAccountModal.tsx` — [NEW]
- `server.ts` — `DELETE /api/user/account` endpoint
- `src/i18n/en.ts`, `es.ts` — new keys

---

### 4b. User Display Name on Email Signup (New Feature)

Add a "Display name" field to the email signup form. Store in `profiles.display_name`.

> [!IMPORTANT]
> Requires confirming whether `profiles.display_name` column exists, and if not, a Supabase migration.

**Files:**
- `src/components/AuthScreen.tsx` — signup form
- `server.ts` or Supabase trigger — save name to profile on signup
- `src/App.tsx` — display name in settings (account card)
- `src/i18n/en.ts`, `es.ts` — new keys

---

### 4c. Guest Mode Indicator (New Feature)

Add a visual indicator when the app is in Guest mode — either a pill/badge near the logo, or a subtitle.

**Fix:** In the header, show a small `"Guest"` or `"Guest Mode"` badge next to the logo when `isGuestMode === true`.

**Files:**
- `src/App.tsx` — header area (~line 4155)
- `src/i18n/en.ts`, `es.ts` — new key

---

### 4d. Manual Referral Code Input on Signup (Comment #40)

Add a "Have an invite code?" input field on the Sign-Up screen so users can enter a referral code without needing a URL parameter.

**Files:**
- `src/components/AuthScreen.tsx` — signup form
- `src/App.tsx` or `AuthScreen.tsx` — call redeem endpoint after signup
- `src/i18n/en.ts`, `es.ts` — new keys

---

### 4e. Audio Processing (Zap) Button — Relocate & De-emphasize (New Feature)

Move the prominent per-clip "Zap" processing button to inside the expanded audio clip (same area as the "Reprocess" button), making it more discreet. Most users will use session consolidation, not per-clip processing.

**Fix:** Remove the Zap button from the collapsed card header. Add it inside the expanded card body, near the Reprocess button.

**Files:**
- `src/App.tsx` — `AudioEntryCard` component (~line 6233)
- `src/i18n/en.ts`, `es.ts` — if any label changes

---

### 4f. Supabase Storage — Delete Files on Media/Audio Deletion (Comment #15)

When a user deletes an audio clip or gallery media item, the raw file should be removed from the Supabase `sessionMedia` storage bucket.

**Fix:** In `deleteAudioEntry` and `deleteMediaItem`, add a `supabase.storage.from('sessionMedia').remove([path])` call after the DB delete.

> [!IMPORTANT]
> Also ensure files are deleted when a **session is deleted** (currently the session delete loops through media and audio items — confirm it already calls `deleteMediaItem` for each, which should then also remove from storage).

**Files:**
- `src/App.tsx` — `deleteAudioEntry`, `deleteMediaItem`, session delete logic

---

### 4g. Hardcoded Text Sweep (New Feature)

Several hardcoded English strings have been found:
- `"Audio clip saved successfully"` — `src/components/RecordingAutoStoppedModal.tsx:51`
- `'Mock Active'` / `'Lab'` — `src/App.tsx:4183`
- Possibly others in toast messages

**Fix:** 
- Audit all `.tsx` files for hardcoded English strings not wrapped in `t()`.
- Move them to `en.ts` / `es.ts`.

**Files:**
- `src/components/RecordingAutoStoppedModal.tsx`
- `src/App.tsx` — Lab/Mock Active labels
- Any other files found in audit

---

## Phase 5 — Glossary Redesign (Separate Scope)

> [!NOTE]
> This is a significant redesign and should be spec'd out separately before implementation. Items from Comments #14 and #26 that weren't fixed in Phase 1c are prerequisites.

**Scope:**
- Pre-fill a comprehensive built-in glossary list (grouped by dance style).
- Session-level glossary selection (user picks which glossaries apply to a session).
- Auto-detection logic: if no glossary is selected, scan all; if one or more are selected, only scan those.
- Global vs. session-level glossary distinction.
- The current unresponsive "Add Glossary" bug must be fixed first (Phase 1c).

---

## Items Noted but Not Requiring Code Changes

| # | Comment | Resolution |
|---|---------|------------|
| 2 | Referral code format — no "ZOU-" prefix | Intentional; code generation in `referrals.ts` does use "ZOU-" prefix, but existing users had codes backfilled without it. OK as-is. |
| 4 | Referral URL capture — install wall still shows | Expected behavior; the `?ref=` param is captured in localStorage and shown on the auth screen. UX could be improved but it's functional. Minor polish. |
| 20 | What does `navigator.share` mean? | This is the OS-level share sheet (like sharing to WhatsApp from iOS). Not a bug — just a checklist explanation item. |
| 37 | Referral code not showing "ZOU-" | Same as #2. |
| 41 | Deleted session shows `deleted: true` not gone | Soft-delete is the correct behavior — cloud sync handles hard deletion. Checklist was wrong. |

---

## Execution Order

```
Phase 1 (Critical): 1a → 1b → 1c
Phase 2 (UX Bugs): 2a → 2b, 2c → 2d → 2e → 2f → 2g → 2h → 2i → 2j, 2k
Phase 3 (Polish):   3a → 3b, 3c → 3d, 3e → 3f, 3g → 3h, 3i
Phase 4 (Features): 4a → 4b, 4c → 4d → 4e → 4f → 4g
Phase 5 (Glossary): [Spec first, then implement]
```

> [!TIP]
> Within each phase, items on the same line can be done in parallel. Items connected by `→` should be done in order.

---

## Verification Plan

### After Each Phase
- Deploy to Render staging.
- Run through the affected checklist items on the live phone app.

### Automated
- No automated test suite currently — verify manually on device.

### Stripe Webhooks (Phase 1a)
- Use Stripe CLI (`stripe listen`) locally to replay webhook events and confirm handlers behave correctly.
- Check Render logs after Stripe portal actions.

### Referral (Phase 1b)
- Sign up as a new user with a referral code, confirm exactly 1 row in `referral_logs`.

