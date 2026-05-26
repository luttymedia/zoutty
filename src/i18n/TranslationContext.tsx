import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Translations } from './en';
import { translations, defaultLanguage, detectBrowserLanguage } from './index';
import type { UILanguage } from './index';

const STORAGE_KEY = 'zoutty_language';

// ─── Helper: interpolate {key} placeholders ───────────────────────────────────
function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{${key}}`
  );
}

// ─── Deep key accessor ────────────────────────────────────────────────────────
// Resolves dot-notation keys like 'toast.folderCreated' → translations object value
function getNestedValue(obj: any, path: string): string {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return path;
    current = current[part];
  }
  if (typeof current !== 'string') return path;
  return current;
}

// ─── Context type ─────────────────────────────────────────────────────────────
interface TranslationContextValue {
  uiLanguage: UILanguage;
  setUILanguage: (lang: UILanguage) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const TranslationContext = createContext<TranslationContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [uiLanguage, setUILanguageState] = useState<UILanguage>(() => {
    // 1. Check localStorage for a previously saved choice
    const saved = localStorage.getItem(STORAGE_KEY) as UILanguage | null;
    if (saved && saved in translations) return saved;
    // 2. Auto-detect from browser
    const detected = detectBrowserLanguage();
    return detected;
  });

  const setUILanguage = useCallback((lang: UILanguage) => {
    localStorage.setItem(STORAGE_KEY, lang);
    setUILanguageState(lang);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const dict: Translations = translations[uiLanguage] ?? translations.en;
      const raw = getNestedValue(dict, key);
      return interpolate(raw, vars);
    },
    [uiLanguage]
  );

  return (
    <TranslationContext.Provider value={{ uiLanguage, setUILanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useTranslation() {
  const ctx = useContext(TranslationContext);
  if (!ctx) throw new Error('useTranslation must be used within a TranslationProvider');
  return ctx;
}
