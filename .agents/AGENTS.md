# Version Bumping Rule
When instructed to bump the project version, you MUST update the version in the following locations:
1. `package.json` - Update the `"version"` field.
2. `src/changelog.ts` - Add a new entry to the `changelog` array with the new version, today's date, and the changes. IMPORTANT: Write the date as a manual string (e.g., `'YYYY-MM-DD'`), do NOT use `new Date().toISOString().split('T')[0]`.
3. `src/version.ts` - Update the exported `version` constant (which propagates the version to the settings drawer footer and the changelog modal).

# Translation Rule
When making modifications or adding new features, you MUST ensure that there is NO hardcoded text in the UI. All user-facing text must be added to the translation files (`src/i18n/en.ts` and `src/i18n/es.ts`) and referenced using the `t()` function.

# Fast Server Startup Rule
When instructed to start or run the dev server for live testing (e.g. on `http://localhost:8181/`):
1. Quick Port Check: Immediately check if port 8181 is already listening (`Get-NetTCPConnection -LocalPort 8181 -ErrorAction SilentlyContinue`). If active and `http://localhost:8181/api/health` returns 200, report it as ready immediately.
2. Fast Start: If not running, launch `npm run dev` directly as a background daemon process (`IsDaemon: true`, `WaitMsBeforeAsync: 3000`).
3. NEVER use `tsx watch server.ts` as it hangs on Windows when combined with Vite middleware. Always use `npm run dev` (configured with `node --import tsx --watch-path=server.ts --watch-path=server server.ts`).
4. Quick Verification: Ping `http://localhost:8181/api/health`. Once it returns HTTP 200 OK, immediately inform the user that the server is up and live-reloading is active. Do NOT run lengthy diagnostic checks or overcomplicate the startup sequence.

