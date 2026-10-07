import { useEffect, useState } from 'react';
import { challengeApi } from '@/lib/challengeApi';
import { setCategories, getCategories } from '@/lib/challenges-data';

// Module-level cache + in-flight promise so every component using categories
// shares a single API call.
//
// Seeded from sessionStorage on load. Categories gate the home page's banner
// and featured grid through `loading`, so on a reload this fetch was part of
// the two-second blank. With the last list to hand, those render at once and
// the refresh replaces them quietly. The key carries the request cache's
// prefix so clearRequestCache() wipes it on sign-out with everything else.
const KEY = 'rc:categories';
let cache = (() => {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.value) && parsed.value.length ? setCategories(parsed.value) : null;
  } catch { return null; }
})();
let promise = null;

export function useCategories(includeInactive = false) {
  const [categories, setCategoriesState] = useState(cache || getCategories());
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let mounted = true;
    if (!promise) {
      promise = challengeApi
        .listCategories(includeInactive)
        .then((cats) => {
          cache = setCategories(cats);
          try { window.sessionStorage.setItem(KEY, JSON.stringify({ value: cats, at: Date.now() })); } catch { /* quota */ }
        })
        .catch(() => {
          cache = cache || getCategories();
        });
    }
    promise.then(() => {
      if (!mounted) return;
      setCategoriesState([...cache]);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [includeInactive]);

  return { categories, loading };
}
