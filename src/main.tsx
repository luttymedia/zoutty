import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import InstallEnforcer from './InstallEnforcer.tsx';
import './index.css';
import { TranslationProvider } from './i18n/TranslationContext';

// Purge any stale service workers and old cache storage
if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch((err) => console.warn('[SW] Cleanup error:', err));
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TranslationProvider>
      <InstallEnforcer>
        <App />
      </InstallEnforcer>
    </TranslationProvider>
  </StrictMode>,
);
