/**
 * Category answer options for the host wizard — always sourced from the live
 * category API (no hardcoded catalogue). Returns an empty list while loading,
 * de-duplicated by slug and ordered by the API's sort order.
 */
import { Palette } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';

export default function useCategoryOptions() {
  const { categories, loading } = useCategories();
  const seen = new Set();
  const options = (categories || [])
    .filter((c) => c.is_active !== false && c.slug)
    .filter((c) => (seen.has(c.slug) ? false : seen.add(c.slug)))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((c) => ({
      value: c.slug,
      label: c.name,
      description: c.blurb || '',
      icon: Palette,
    }));
  return { options, loading };
}