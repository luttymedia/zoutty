# Version Bumping Rule
When instructed to bump the project version, you MUST update the version in the following locations:
1. `package.json` - Update the `"version"` field.
2. `src/changelog.ts` - Add a new entry to the `changelog` array with the new version, today's date, and the changes. IMPORTANT: Write the date as a manual string (e.g., `'YYYY-MM-DD'`), do NOT use `new Date().toISOString().split('T')[0]`.
3. `src/version.ts` - Update the exported `version` constant (which propagates the version to the settings drawer footer and the changelog modal).

# Translation Rule
When making modifications or adding new features, you MUST ensure that there is NO hardcoded text in the UI. All user-facing text must be added to the translation files (`src/i18n/en.ts` and `src/i18n/es.ts`) and referenced using the `t()` function.
