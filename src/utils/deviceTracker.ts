import { supabase } from '../lib/supabase';

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

const STORAGE_KEY = 'zoutty_device_install_tracked_v1';

/**
 * Tracks the PWA installation event to the server.
 * Ensures each device/installation is tracked once to avoid inflating stats.
 */
export async function trackInstallation(
  source: 'pwa_prompt' | 'standalone_launch' | 'ios_standalone' | 'ios_guide' | 'related_apps' | 'manual' = 'pwa_prompt',
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

    // Attach user auth token if session exists
    let authHeader: string | undefined;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        authHeader = `Bearer ${session.access_token}`;
      }
    } catch (_) {}

    const payload = {
      ...info,
      installSource: source,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const res = await fetch('/api/track-install', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
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
    } else {
      console.warn('[tracker] Server responded with error tracking install:', res.status);
    }
  } catch (err) {
    console.warn('[tracker] Failed to track installation:', err);
  }

  return false;
}
