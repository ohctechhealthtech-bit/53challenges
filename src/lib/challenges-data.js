// Core domain definitions for 53 Challenges — Australia's Creative Discovery Platform.

// Runtime category list — populated from the live Challenge API
// (publicChallengeApi?action=categories) by the useCategories() hook.
// Starts empty; categoryMeta/normalizeCategory gracefully handle any slug
// even before the list loads.
let CATEGORIES = [];

const CATEGORY_PALETTE = ['#2D7DD2', '#E86A33', '#D4537E', '#F0932B', '#3BA55D', '#12B5A5', '#8E44FF', '#1D63ED'];

const ICON_KEYWORDS = [
  { keys: ['music', 'dance', 'perform', 'sing', 'voice'], icon: '🎤' },
  { keys: ['photo', 'film', 'video', 'digital'], icon: '📷' },
  { keys: ['writ', 'poet', 'idea', 'innov'], icon: '✍️' },
  { keys: ['food', 'farm', 'cook', 'community'], icon: '🌾' },
  { keys: ['outdoor', 'adventure', 'sport', 'fish'], icon: '🏞️' },
  { keys: ['art', 'craft', 'paint', 'visual', 'mak'], icon: '🎨' },
  { keys: ['studio'], icon: '🎬' },
  { keys: ['market', 'sell', 'shop'], icon: '🛍️' },
];

function guessIcon(text) {
  const t = String(text || '').toLowerCase();
  for (const { keys, icon } of ICON_KEYWORDS) {
    if (keys.some((k) => t.includes(k))) return icon;
  }
  return '🎨';
}

// Populate the runtime category list from the live API response.
export function setCategories(list) {
  CATEGORIES = (list || []).map((c, i) => ({
    slug: String(c.slug || c.key || '').replace(/_/g, '-').toLowerCase(),
    name: c.name || c.label || c.slug || 'Category',
    color: c.color || CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
    icon: c.icon || guessIcon(`${c.slug || c.key || ''} ${c.name || c.label || ''}`),
    blurb: c.blurb || c.description || '',
    image: c.image || c.image_url || '',
    sort_order: c.sort_order ?? i,
    is_active: c.is_active !== false,
  }));
  return CATEGORIES;
}

export function getCategories() { return CATEGORIES; }

// Normalize an incoming category slug to a canonical hyphenated lowercase slug.
// The live Challenge API is the source of truth — no remapping to legacy
// hardcoded parent categories.
export function normalizeCategory(slug) {
  return String(slug || '').toLowerCase().trim().replace(/_/g, '-');
}

export const DIVISIONS = [
  { slug: 'children', name: 'Children', tagline: 'Ages 7–12' },
  { slug: 'teens',    name: 'Teens',    tagline: 'Ages 13–19' },
  { slug: 'adults',   name: 'Adults',   tagline: '20+' },
  { slug: 'ndi',      name: 'NDIs',     tagline: 'NDI division' },
];

export const STATES = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

export const ECOSYSTEM = [
  { slug: 'classes',     name: '53 Classes',     verb: 'Learn',     icon: '🎓', color: '#1D63ED', blurb: 'Master your craft with expert-led courses.',        live: true,  url: 'https://53classes.com/' },
  { slug: 'challenges',  name: '53 Challenges',  verb: 'Compete',   icon: '🏆', color: '#E86A33', blurb: 'Prove your skills and get discovered.',            current: true, live: true, url: 'https://53challenges.com/' },
  { slug: 'gallery',     name: '53 Cox Road Gallery', verb: 'Showcase', icon: '🖼️', color: '#8E44FF', blurb: 'A curated home for the best work across the 53 family.', live: true, url: 'https://53coxroadgallery.com/' },
  { slug: 'studios',     name: '53 Studios',     verb: 'Create',    icon: '🎬', color: '#D4537E', blurb: 'Tools and spaces to make your best work.',         live: false },
  { slug: 'marketplace', name: '53 Marketplace', verb: 'Sell',      icon: '🛍️', color: '#3BA55D', blurb: 'Turn your creativity into income.',                live: false },
  { slug: 'jobs',        name: '53 Jobs',        verb: 'Work',      icon: '💼', color: '#F0932B', blurb: 'Get hired for real creative briefs.',              live: false },
  { slug: 'foundation',  name: '53 Foundation',  verb: 'Give Back', icon: '💛', color: '#12B5A5', blurb: 'Scholarships and access for every creator.',       live: false },
];

export const FUNNEL = [
  { icon: '📱', label: 'Discover',  detail: 'A challenge catches your eye on Instagram or TikTok.' },
  { icon: '🏆', label: 'Compete',  detail: 'You enter a challenge and share your work with the world.' },
  { icon: '🗳️', label: 'Get Votes', detail: 'Your community votes, and the nation notices you.' },
  { icon: '⭐', label: 'Get Found', detail: 'Brands, studios and recruiters spot your talent.' },
  { icon: '🚀', label: 'Grow',     detail: 'You join 53 Classes, Studios and Jobs to keep climbing.' },
];

export const CYCLE = [
  { icon: '🌱', label: 'Learn',    detail: 'Build skills in 53 Classes.' },
  { icon: '🎨', label: 'Create',   detail: 'Make original work in 53 Studios.' },
  { icon: '🏆', label: 'Compete',  detail: 'Prove yourself in 53 Challenges.' },
  { icon: '🛍️', label: 'Sell',    detail: 'Earn income on 53 Marketplace.' },
  { icon: '💼', label: 'Work',     detail: 'Land real briefs through 53 Jobs.' },
];

export function categoryBySlug(slug) { return CATEGORIES.find(c => c.slug === slug); }

// Metadata for any category slug — resolves against the runtime category list
// (populated from the API); unknown slugs get a generated name + default accent
// so they still render a pill instead of vanishing.
export function categoryMeta(slug) {
  const norm = normalizeCategory(slug);
  const known = categoryBySlug(norm);
  if (known) return known;
  const name = (norm || 'other').replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  return { slug: norm, name, color: '#6D4AFF', icon: guessIcon(name), blurb: name };
}
export function divisionBySlug(slug) { return DIVISIONS.find(d => d.slug === slug); }

// Interim compliance gate (Prompt 13) — true when the challenge's local gate
// has launch_blocked=true. Challenges are annotated with compliance_blocked
// by challengeApi.listChallenges / getChallenge via the complianceGate function.
export function isComplianceBlocked(ch) {
  return !!ch?.compliance_blocked;
}

// Days remaining until a deadline ISO string.
export function daysLeft(iso) {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

// True only when a challenge is genuinely accepting entries — the external
// API's `status` field is the source of truth (a "completed" challenge rejects
// entries even if its end date is still in the future), combined with the
// date-based submission phase.
export function isOpenForEntries(ch) {
  if (ch?.compliance_blocked) return false;
  return String(ch?.status).toLowerCase() === 'active' && challengePhase(ch) === 'submit';
}

// Determine the phase of a challenge.
export function challengePhase(ch) {
  // The upstream `status` field is authoritative — a "completed" challenge is
  // closed even if its voting_end_date is still in the future.
  const status = String(ch?.status || '').toLowerCase();
  if (status === 'completed' || status === 'closed' || status === 'archived') return 'closed';
  const now = Date.now();
  if (ch.starts_at && now < new Date(ch.starts_at).getTime()) return 'upcoming';
  if (ch.submission_ends_at && now < new Date(ch.submission_ends_at).getTime()) return 'submit';
  if (ch.voting_ends_at && now < new Date(ch.voting_ends_at).getTime()) return 'vote';
  return 'closed';
}

// ─── Shared public-visibility filter ───────────────────────────────────
// Single source of truth for excluding test, QA, draft, internal, deleted,
// cancelled or unpublished challenges from all public-facing surfaces.
// Used by: featured challenge, live tabs, category counts, cards, detail pages.
export function isPublicChallenge(ch) {
  if (!ch) return false;
  const title = (ch.title || ch.theme || '').trim();
  if (!title) return false;
  const status = String(ch.status || '').toLowerCase();
  if (['draft', 'cancelled', 'deleted', 'unpublished', 'archived', 'internal', 'test'].includes(status)) return false;
  return true;
}

// ─── Unified challenge status ────────────────────────────────────────
// Returns phase + display metadata for any challenge. Consumers should call
// isPublicChallenge() first to exclude non-public records, then use this
// for display labels and colours.
const STATUS_META = {
  upcoming: { label: 'Coming Soon', colour: '#d4af37' },
  submit:   { label: 'Open for Entries', colour: '#00a8a8' },
  vote:     { label: 'Voting Now', colour: '#00a8a8' },
  closed:   { label: 'Closed', colour: '#6b7280' },
};

export function challengeStatus(ch) {
  const phase = challengePhase(ch);
  const meta = STATUS_META[phase] || STATUS_META.closed;
  return { phase, label: meta.label, colour: meta.colour };
}

// Return the description text, preferring `brief` but falling back to
// `description` only when they differ — prevents the same text rendering twice.
export function challengeDescription(ch) {
  if (!ch) return '';
  const brief = (ch.brief || '').trim();
  const desc = (ch.description || '').trim();
  if (brief && desc && brief !== desc) return brief;
  return brief || desc;
}

// Return the display title — prefers theme, falls back to title.
export function challengeTitle(ch) {
  return (ch?.theme || ch?.title || '').trim();
}

// Assign a division from a date-of-birth string.
export function ageAt(dobISO, refISO) {
  const dob = new Date(dobISO);
  const ref = new Date(refISO);
  let age = ref.getFullYear() - dob.getFullYear();
  const m = ref.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age--;
  return age;
}

export function assignDivision(dobISO, refISO, isNDI) {
  if (isNDI) return 'ndi';
  const age = ageAt(dobISO, refISO);
  if (age < 7) return null;
  if (age <= 12) return 'children';
  if (age <= 19) return 'teens';
  return 'adults';
}