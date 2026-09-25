import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Default logo — used when no custom logo has been set by an admin.
export const DEFAULT_LOGO_URL =
  'https://base44.app/api/apps/6a683318ec3c2cc96e77b420/files/mp/public/6a683318ec3c2cc96e77b420/ca9969246_INTRANSPARENT.png';

let cachedSettings = {};
let listeners = new Set();
let initialized = false;

async function fetchSettings() {
  try {
    const items = await base44.entities.SiteSetting.list();
    const obj = {};
    for (const it of items) obj[it.key] = it.value;
    cachedSettings = obj;
  } catch {
    cachedSettings = {};
  }
  listeners.forEach((fn) => fn(cachedSettings));
}

/**
 * Returns the current site settings (key → value map). All components
 * sharing this hook see the same cached data; `refreshSiteSettings()`
 * re-fetches and broadcasts to every listener (used by the admin
 * branding panel after a save).
 */
export function useSiteSettings() {
  const [settings, setSettings] = useState(cachedSettings);

  useEffect(() => {
    listeners.add(setSettings);
    if (!initialized) {
      initialized = true;
      fetchSettings();
    }
    return () => { listeners.delete(setSettings); };
  }, []);

  return { settings };
}

/** Re-fetch settings from the database and broadcast to all listeners. */
export function refreshSiteSettings() {
  return fetchSettings();
}