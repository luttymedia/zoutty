import { supabase } from '../lib/supabase';
import { apiUrl } from '../lib/api';

export interface DeviceInfo {
  devicePlatform: 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'ChromeOS' | 'Other';
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browser: string;
  browserVersion?: string;
  osVersion?: string;
  userAgent: string;
  screenResolution: string;
  screenDensity: number;
  language: string;
  timezone: string;
  rawDetails?: Record<string, any>;
}

/**
 * Parses detailed device and browser information from the client environment.
 */
export function getDeviceInfo(): DeviceInfo {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const navAny = typeof navigator !== 'undefined' ? (navigator as any) : {};

  // Check iPad pretending to be Mac (iPadOS 13+)
  const isIPadOS = navAny.platform === 'MacIntel' && navAny.maxTouchPoints > 1;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || isIPadOS;
  const isAndroid = /Android/i.test(ua);
  const isWindows = /Windows NT/i.test(ua);
  const isMac = !isIPadOS && /Macintosh|Mac OS X/i.test(ua);
  const isChromeOS = /CrOS/i.test(ua);
  const isLinux = !isAndroid && !isChromeOS && /Linux/i.test(ua);

  let devicePlatform: DeviceInfo['devicePlatform'] = 'Other';
  if (isIOS) devicePlatform = 'iOS';
  else if (isAndroid) devicePlatform = 'Android';
  else if (isWindows) devicePlatform = 'Windows';
  else if (isMac) devicePlatform = 'macOS';
  else if (isChromeOS) devicePlatform = 'ChromeOS';
  else if (isLinux) devicePlatform = 'Linux';

  // Device Type determination
  const isTablet =
    isIPadOS ||
    /iPad/i.test(ua) ||
    (/Android/i.test(ua) && !/Mobile/i.test(ua)) ||
    /Tablet|PlayBook|Silk/i.test(ua);

  const isMobile =
    !isTablet &&
    (isIOS ||
      /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated/i.test(ua) ||
      (typeof window !== 'undefined' && window.innerWidth < 768 && navAny.maxTouchPoints > 0));

  const deviceType: DeviceInfo['deviceType'] = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  // Browser detection
  let browser = 'Unknown';
  let browserVersion: string | undefined;

  const edgeMatch = ua.match(/Edg(?:e|A|iOS)?\/([0-9.]+)/i);
  const samsungMatch = ua.match(/SamsungBrowser\/([0-9.]+)/i);
  const operaMatch = ua.match(/(?:OPR|OPiOS)\/([0-9.]+)/i);
  const chromeMatch = ua.match(/(?:Chrome|CriOS)\/([0-9.]+)/i);
  const firefoxMatch = ua.match(/(?:Firefox|FxiOS)\/([0-9.]+)/i);
  const safariMatch = ua.match(/Version\/([0-9.]+).*Safari/i);

  if (edgeMatch) {
    browser = 'Edge';
    browserVersion = edgeMatch[1];
  } else if (samsungMatch) {
    browser = 'Samsung Internet';
    browserVersion = samsungMatch[1];
  } else if (operaMatch) {
    browser = 'Opera';
    browserVersion = operaMatch[1];
  } else if (chromeMatch) {
    browser = 'Chrome';
    browserVersion = chromeMatch[1];
  } else if (firefoxMatch) {
    browser = 'Firefox';
    browserVersion = firefoxMatch[1];
  } else if (safariMatch) {
    browser = 'Safari';
    browserVersion = safariMatch[1];
  } else if (/Safari/i.test(ua)) {
    browser = 'Safari';
  }

  // OS Version extraction
  let osVersion: string | undefined;
  if (isIOS) {
    const match = ua.match(/OS (\d+[_.]\d+(?:[_.]\d+)?)/i);
    if (match) osVersion = match[1].replace(/_/g, '.');
  } else if (isAndroid) {
    const match = ua.match(/Android (\d+(?:\.\d+)?)/i);
    if (match) osVersion = match[1];
  } else if (isWindows) {
    const match = ua.match(/Windows NT (\d+\.\d+)/i);
    if (match) {
      const ntMap: Record<string, string> = {
        '10.0': '10/11',
        '6.3': '8.1',
        '6.2': '8',
        '6.1': '7',
      };
      osVersion = ntMap[match[1]] || match[1];
    }
  } else if (isMac) {
    const match = ua.match(/Mac OS X (\d+[_.]\d+(?:[_.]\d+)?)/i);
    if (match) osVersion = match[1].replace(/_/g, '.');
  }

  const screenResolution =
    typeof window !== 'undefined' && window.screen
      ? `${window.screen.width}x${window.screen.height}`
      : '0x0';
  const screenDensity = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const language = typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en';

  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (_) {}

  const rawDetails: Record<string, any> = {
    displayMode:
      typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
        ? 'standalone'
        : 'browser',
    isAppleStandalone: typeof window !== 'undefined' && Boolean((window.navigator as any).standalone),
  };

  if (navAny.userAgentData) {
    rawDetails.userAgentData = {
      mobile: navAny.userAgentData.mobile,
      platform: navAny.userAgentData.platform,
    };
  }

  return {
    devicePlatform,
    deviceType,
    browser,
    browserVersion,
    osVersion,
    userAgent: ua,
    screenResolution,
    screenDensity,
    language,
    timezone,
    rawDetails,
  };
}

const STORAGE_KEY = 'zoutty_device_install_tracked_v2';

/**
 * Tracks the PWA installation event to Supabase and the server.
 * Uses direct Supabase client insertion first for guaranteed delivery on static/mobile clients,
 * and pings the backend API for IP logging.
 */
export async function trackInstallation(
  source: 'pwa_prompt' | 'standalone_launch' | 'ios_standalone' | 'ios_guide' | 'related_apps' | 'existing_install' | 'manual' = 'pwa_prompt',
  force: boolean = false
): Promise<boolean> {
  try {
    if (!force && typeof localStorage !== 'undefined') {
      const alreadyTracked = localStorage.getItem(STORAGE_KEY);
      if (alreadyTracked) {
        return false;
      }
    }

    const info = getDeviceInfo();
    let trackedSuccessfully = false;

    // 1. Direct Supabase insertion (immediate, guaranteed delivery on mobile & static hosts)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const insertPayload = {
        user_id: session?.user?.id || null,
        device_platform: info.devicePlatform,
        device_type: info.deviceType,
        browser: info.browser,
        browser_version: info.browserVersion || null,
        os_version: info.osVersion || null,
        user_agent: (info.userAgent || '').slice(0, 500),
        screen_resolution: info.screenResolution,
        screen_density: info.screenDensity,
        install_source: source,
        language: info.language,
        timezone: info.timezone,
        raw_details: info.rawDetails || {},
      };

      const { data, error } = await supabase
        .from('install_tracking')
        .insert(insertPayload)
        .select('id')
        .maybeSingle();

      if (!error && data?.id) {
        trackedSuccessfully = true;
        console.log('[tracker] Device successfully tracked in Supabase:', data.id, info.devicePlatform);
      } else if (error) {
        console.warn('[tracker] Supabase direct insert note:', error.message);
      }
    } catch (dbErr) {
      console.warn('[tracker] Supabase direct tracking error:', dbErr);
    }

    // 2. Also notify backend API (to log request IP and trigger server telemetry)
    try {
      let authHeader: string | undefined;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        authHeader = `Bearer ${session.access_token}`;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }

      const endpoint = apiUrl('/api/track-install');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...info, installSource: source }),
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          trackedSuccessfully = true;
        }
      }
    } catch (_) {}

    // Only set localStorage if actually tracked
    if (trackedSuccessfully) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            trackedAt: Date.now(),
            platform: info.devicePlatform,
            browser: info.browser,
            source,
          })
        );
      }
      return true;
    }
  } catch (err) {
    console.warn('[tracker] Failed to track installation:', err);
  }

  return false;
}
