/**
 * Central API Client and Configuration
 * 
 * Environment handling:
 * - Local development: VITE_API_URL is unset or empty -> requests use relative path ('/api/...')
 *   which routes cleanly through the unified server on :8181 or Vite's dev proxy.
 * - Production / Staging: VITE_API_URL is set (e.g. 'https://zoutty-api.onrender.com') ->
 *   requests target the remote Render Node Web Service directly.
 */

export const API_BASE_URL: string = (
  (import.meta.env.VITE_API_URL as string | undefined) || ''
).replace(/\/+$/, '');

/**
 * Returns full API URL for a given relative path (e.g. '/api/health' -> 'https://zoutty-api.onrender.com/api/health')
 */
export function apiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : ('/' + endpoint);
  return API_BASE_URL + cleanEndpoint;
}

export type ApiStatus = 'idle' | 'checking' | 'waking' | 'ready' | 'unavailable';

type StatusListener = (status: ApiStatus) => void;

class ApiStateManager {
  private status: ApiStatus = 'idle';
  private listeners: Set<StatusListener> = new Set();
  private checkPromise: Promise<boolean> | null = null;

  public getStatus(): ApiStatus {
    return this.status;
  }

  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setStatus(newStatus: ApiStatus) {
    if (this.status === newStatus) return;
    this.status = newStatus;
    this.listeners.forEach((l) => l(newStatus));
  }

  /**
   * Pings the /api/health route. If the service is asleep, triggers a polling
   * wake-up sequence and marks status as 'waking' until the service replies with 200 OK.
   */
  public async pingAndWake(options?: { timeoutMs?: number; maxRetries?: number }): Promise<boolean> {
    if (this.status === 'ready') return true;
    if (this.checkPromise) return this.checkPromise;

    const timeoutMs = options?.timeoutMs ?? 4000;
    const maxRetries = options?.maxRetries ?? 15; // ~50s max polling

    this.checkPromise = (async () => {
      this.setStatus('checking');

      // 1. Initial quick probe
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(apiUrl('/api/health'), { signal: controller.signal });
        clearTimeout(timer);

        if (res.ok) {
          this.setStatus('ready');
          this.checkPromise = null;
          return true;
        }
      } catch {
        // Fast probe failed or timed out — service is cold / spinning up
      }

      // 2. Transition to waking state and poll in background
      this.setStatus('waking');

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await new Promise((r) => setTimeout(r, 3500));
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(apiUrl('/api/health'), { signal: controller.signal });
          clearTimeout(timer);

          if (res.ok) {
            this.setStatus('ready');
            this.checkPromise = null;
            return true;
          }
        } catch {
          // Still waiting for instance to boot up
        }
      }

      this.setStatus('unavailable');
      this.checkPromise = null;
      return false;
    })();

    return this.checkPromise;
  }

  /**
   * Reset status to allow manual retry if previously unavailable
   */
  public retry(): Promise<boolean> {
    this.status = 'idle';
    return this.pingAndWake();
  }
}

export const apiState = new ApiStateManager();
