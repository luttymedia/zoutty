/**
 * drive.ts — Google Drive "Bring Your Own Cloud" integration for Zoutty.
 *
 * Uses Google Identity Services (GIS) implicit flow to acquire a short-lived
 * OAuth access token scoped ONLY to the hidden Application Data folder
 * (drive.appdata). Zoutty can NEVER read any other file in the user's Drive.
 *
 * All functions are purely client-side — no backend required.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
// openid + email + profile ensures Google includes an id_token JWT in the
// OAuth response, letting us read the user's email without any extra API call.
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata openid email profile';
const BACKUP_FILENAME = 'zoutty_backup.json';

const TOKEN_KEY = 'zoutty_gdrive_token';
const TOKEN_EXPIRY_KEY = 'zoutty_gdrive_token_expiry';
const ACCOUNT_KEY = 'zoutty_gdrive_account';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriveAccount {
  email: string;
  name: string;
  picture?: string;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

function saveToken(token: string, expiresInSeconds: number): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresInSeconds * 1000));
}

function getStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!token || !expiry) return null;
  if (Date.now() > Number(expiry)) {
    // Clear only the token — keep account info so the UI stays "linked"
    // and silent refresh can be attempted on the next operation.
    clearDriveToken();
    return null;
  }
  return token;
}

/** Clears only the access token and expiry (not the account record). */
export function clearDriveToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

/**
 * Returns milliseconds until the token should be proactively refreshed
 * (5 minutes before it expires). Returns 0 if the token is already expired
 * or absent, which means a refresh is overdue / not possible silently.
 */
export function getTokenMsUntilRefresh(): number {
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiry) return 0;
  const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 min before expiry
  return Math.max(0, Number(expiry) - Date.now() - REFRESH_BUFFER_MS);
}

/** Clears everything — token, expiry, and account info. Used on explicit disconnect. */
export function clearDriveAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(ACCOUNT_KEY);
}

/**
 * Returns true if the user has previously linked a Google account,
 * regardless of whether the current access token is still valid.
 * Used to keep the UI in "connected" state across token expiry events.
 */
export function hasSavedAccount(): boolean {
  return localStorage.getItem(ACCOUNT_KEY) !== null;
}

export function getStoredDriveAccount(): DriveAccount | null {
  const raw = localStorage.getItem(ACCOUNT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DriveAccount;
  } catch {
    return null;
  }
}

export function isDriveConnected(): boolean {
  return getStoredToken() !== null;
}

// ─── Account info helper ─────────────────────────────────────────────────────

/**
 * Fetches the user's profile from Google's userinfo endpoint using the
 * access token. Works because we request 'openid email profile' scopes,
 * which authorise this endpoint.
 */
async function fetchAndSaveAccount(token: string): Promise<void> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const p = await res.json();
      const account: DriveAccount = {
        email: p.email || '',
        name: p.name || p.email || '',
        picture: p.picture,
      };
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    } else {
      console.warn('[Drive] userinfo returned', res.status);
    }
  } catch (e) {
    console.warn('[Drive] Failed to fetch user profile:', e);
  }
}

// ─── GIS script loader ────────────────────────────────────────────────────────

function waitForGIS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const interval = setInterval(() => {
      if ((window as any).google?.accounts?.oauth2) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
    setTimeout(() => {
      clearInterval(interval);
      reject(new Error('Google Identity Services failed to load. Please refresh the page and try again.'));
    }, 10000);
  });
}

// ─── OAuth – request a fresh token ───────────────────────────────────────────

/**
 * Attempts a silent GIS token refresh — no popup shown.
 * Works as long as the user still has an active Google session in the browser
 * (which is typically the case for weeks/months).
 * Rejects if the Google session has genuinely expired.
 */
export async function silentlyRefreshToken(): Promise<string> {
  await waitForGIS();

  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      prompt: '',
      callback: async (response: any) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        const token: string = response.access_token;
        const expiresIn: number = Number(response.expires_in) || 3600;
        saveToken(token, expiresIn);
        // Re-fetch account in case it was cleared
        if (!localStorage.getItem(ACCOUNT_KEY)) {
          await fetchAndSaveAccount(token);
        }
        resolve(token);
      },
    });

    client.requestAccessToken({ prompt: '' });
  });
}

/**
 * Returns a valid cached access token, or throws if the token is absent /
 * expired. Callers that need a token must either hold a valid one (proactive
 * refresh keeps this true while the app is open) or explicitly prompt the
 * user to reconnect. We never call GIS here to avoid unexpected Google UI.
 */
export async function requestDriveToken(): Promise<string> {
  const cached = getStoredToken();
  if (cached) return cached;
  throw new Error('drive_token_expired');
}

/**
 * Explicitly prompts the user to choose/switch their Google account.
 * Always shows the account picker.
 */
export async function connectDriveAccount(): Promise<string> {
  clearDriveAuth();
  await waitForGIS();

  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: async (response: any) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        const token: string = response.access_token;
        const expiresIn: number = Number(response.expires_in) || 3600;
        saveToken(token, expiresIn);
        await fetchAndSaveAccount(token);
        resolve(token);
      },
    });

    // Force account picker
    client.requestAccessToken({ prompt: 'select_account consent' });
  });
}

// ─── Drive API helpers ────────────────────────────────────────────────────────

async function authorizedFetch(url: string, options: RequestInit, token: string): Promise<Response> {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}

/**
 * Find the file ID of the existing backup in appDataFolder, or null if not found.
 */
async function findBackupFileId(token: string): Promise<string | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    fields: 'files(id,name)',
    q: `name = '${BACKUP_FILENAME}'`,
  });
  const res = await authorizedFetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    { method: 'GET' },
    token
  );
  if (!res.ok) throw new Error(`Drive list error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

/**
 * Upload (create or update) the backup JSON to appDataFolder.
 * Uses multipart upload to set metadata and body in one request.
 */
export async function uploadBackupToDrive(backupJson: string): Promise<void> {
  const token = await requestDriveToken();

  const existingId = await findBackupFileId(token);

  const metadata = {
    name: BACKUP_FILENAME,
    parents: existingId ? undefined : ['appDataFolder'],
  };

  const boundary = 'zoutty_backup_boundary_' + Date.now();
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    backupJson,
    `--${boundary}--`,
  ].join('\r\n');

  let url: string;
  let method: string;

  if (existingId) {
    // PATCH to update existing file content
    url = `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`;
    method = 'PATCH';
  } else {
    // POST to create new file
    url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    method = 'POST';
  }

  const res = await authorizedFetch(
    url,
    {
      method,
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
    token
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload error: ${res.status} — ${err}`);
  }
}

/**
 * Download the backup JSON from appDataFolder and return as a parsed object.
 * Returns null if no backup exists yet.
 */
export async function downloadBackupFromDrive(): Promise<object | null> {
  const token = await requestDriveToken();

  const fileId = await findBackupFileId(token);
  if (!fileId) return null;

  const res = await authorizedFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { method: 'GET' },
    token
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive download error: ${res.status} — ${err}`);
  }

  return res.json();
}
