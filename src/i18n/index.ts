import en from './en';
import es from './es';

// UILanguage is for the app UI, separate from the audio transcription Language type in types.ts
export type UILanguage = 'en' | 'es';

export const translations = { en, es } as const;

export const UI_LANGUAGE_NAMES: Record<UILanguage, string> = {
  en: 'English',
  es: 'Español',
};

export const defaultLanguage: UILanguage = 'en';

/** Detect the browser's preferred UI language, falling back to English. */
export function detectBrowserLanguage(): UILanguage {
  const browserLang = navigator.language || (navigator as any).userLanguage || 'en';
  const normalized = browserLang.toLowerCase();
  if (normalized.startsWith('es')) return 'es';
  return 'en'; // default fallback
}

export { en, es };
