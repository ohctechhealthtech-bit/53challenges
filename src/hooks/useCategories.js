import { useEffect, useState } from 'react';
import { challengeApi } from '@/lib/challengeApi';
import { setCategories, getCategories } from '@/lib/challenges-data';

// Module-level cache + in-flight promise so every component using categories
// shares a single API call.
let cache = null;
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
        })
        .catch(() => {
          cache = getCategories();
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