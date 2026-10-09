import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Default logo — used when no custom logo has been set by an admin.
export const DEFAULT_LOGO_URL =
  'https://base44.app/api/apps/6a683318ec3c2cc96e77b420/files/mp/public/6a683318ec3c2cc96e77b420/ca9969246_INTRANSPARENT.png';
// Seeded from sessionStorage, so on a repeat visit the admin-set logo URL is
// known at first paint instead of arriving after a fetch. Without this the
// default logo showed for a moment and then swapped to the custom one; with
// it, the first logo drawn is the right one. The key carries the request
// cache's prefix so clearRequestCache() wipes it on sign-out with the rest.
const KEY = 'rc:site-settings';
function readSeed() {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.value === 'object' && parsed.value ? parsed.value : {};
  } catch { return {}; }
}
function writeSeed(obj) {
  try { window.sessionStorage.setItem(KEY, JSON.stringify({ value: obj, at: Date.now() })); } catch { /* quota */ }
}

let cachedSettings = readSeed();

let listeners = new Set();
let initialized = false;

async function fetchSettings() {
  try {
    const items = await base44.entities.SiteSetting.list();
    const obj = {};
    for (const it of items) obj[it.key] = it.value;
    cachedSettings = obj;
    writeSeed(obj);
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