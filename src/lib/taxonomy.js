// Taxonomy hygiene & discovery helpers (Prompt 14).
//
// Single source of truth for "is this taxonomy record pickable?" and for
// free-text discovery matching. Importing this from pickers / search surfaces
// keeps behaviour consistent: deactivating a Category/Subcategory removes it
// from every new-challenge picker, while challenges that already reference it
// keep rendering (they store the slug/name as a plain string, not a FK that
// breaks). `niche_tags` participates in search matching ONLY — it never
// affects structure, rules, judging, or compliance.

// A taxonomy record is pickable unless it has explicitly been deactivated.
// `is_active` defaults to true, so legacy records (created before Prompt 14)
// remain visible. This also tolerates records missing the field entirely.
export function isTaxonomyActive(rec) {
  return rec ? rec.is_active !== false : false;
}

// Filter a list of Category/Subcategory records to only active ones.
export function activeTaxonomy(list) {
  return (list || []).filter(isTaxonomyActive);
}

// Sort taxonomy records by sort_order (ascending, nulls/missing last), then by
// name for a stable secondary order. Used by pickers so admins can control the
// display order without touching names.
export function orderedTaxonomy(list) {
  return activeTaxonomy(list).slice().sort((a, b) => {
    const sa = typeof a.sort_order === 'number' ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const sb = typeof b.sort_order === 'number' ? b.sort_order : Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

// URL-safe slug from a free-form name. Used when seeding/maintaining Category
// and Subcategory slugs so they stay URL-safe and unique.
export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Free-text discovery match for a challenge. Matches against the challenge's
// title, theme, brief, description, category, AND niche_tags. `niche_tags`
// affects search/discovery/feed targeting ONLY — nothing else reads it.
export function matchChallengeSearch(ch, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  if (!ch) return false;
  const parts = [
    ch.title,
    ch.theme,
    ch.brief,
    ch.description,
    ch.category,
  ];
  if (Array.isArray(ch.niche_tags)) parts.push(...ch.niche_tags);
  const hay = parts.filter(Boolean).join(' \u0001 ').toLowerCase();
  // Split the query on whitespace so multi-word queries match across fields.
  return q.split(/\s+/).every((token) => hay.includes(token));
}