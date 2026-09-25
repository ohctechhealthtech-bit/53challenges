// Subdomain slug rules for challenge-specific domains.
//
// The authoritative copy. src/lib/subdomainValidation.js mirrors it for the
// browser; keep the two in step when the rules change. The backend re-
// validates every slug regardless of what the form allowed through.

// Hostnames that must keep pointing at platform infrastructure rather than a
// challenge. Blocking them here stops an admin creating a subdomain that
// shadows mail, DNS or the app's own entry points.
const RESERVED_SLUGS = new Set([
  'www', 'api', 'app', 'admin', 'dashboard', 'portal', 'login', 'auth',
  'mail', 'smtp', 'imap', 'pop', 'webmail', 'ftp', 'ns1', 'ns2', 'mx',
  'cdn', 'static', 'assets', 'media', 'files', 'img',
  'dev', 'staging', 'test', 'preview', 'base44',
  'my', 'host', 'judge', 'sponsor', 'guardian',
  'localhost',
]);

// Domains that are owned by the platform and must never be registered as
// independent "full domain" entries — the admin should use the subdomain flow.
const PLATFORM_BASE_DOMAIN = '53challenges.com';

/** Coerce free-text input into a valid DNS label, as far as that is possible. */
export function normalizeSlug(slug: string): string {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_.]+/g, '-')    // spaces, underscores and dots become hyphens
    .replace(/[^a-z0-9-]/g, '')  // drop anything else outright
    .replace(/^-+|-+$/g, '');    // a DNS label cannot start or end with a hyphen
}

/**
 * Validate a slug. Accepts raw or already-normalized input — it normalizes
 * first, so the form's live preview and its submit path always agree.
 * Returns { valid: true } or { valid: false, error }.
 */
export function validateSlug(slug: string): { valid: boolean; error?: string } {
  const s = normalizeSlug(slug);
  if (!s) {
    return { valid: false, error: 'Enter a slug using letters, numbers and hyphens.' };
  }
  if (s.length < 2) {
    return { valid: false, error: 'Slug must be at least 2 characters.' };
  }
  if (s.length > 63) {
    return { valid: false, error: 'Slug must be 63 characters or fewer.' };
  }
  if (s.startsWith('xn--')) {
    return { valid: false, error: '"xn--" is reserved for internationalised domain names.' };
  }
  if (RESERVED_SLUGS.has(s)) {
    return { valid: false, error: `"${s}" is reserved and cannot be used as a challenge subdomain.` };
  }
  return { valid: true };
}

/**
 * Validate a full independent domain name (e.g. "example.com").
 * Rejects protocols, paths, ports, query strings, IP addresses, whitespace,
 * localhost, and domains ending in the platform base domain.
 */
export function validateFullDomain(input: string): { valid: boolean; error?: string; normalized?: string } {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return { valid: false, error: 'Full domain name is required.' };
  if (raw !== String(input).trim()) {
    return { valid: false, error: 'Domain name must not contain leading or trailing whitespace.' };
  }
  if (/\s/.test(raw)) return { valid: false, error: 'Domain name must not contain whitespace.' };
  if (/^[0-9.]+$/.test(raw) && /^\d+\.\d+\.\d+\.\d+$/.test(raw)) {
    return { valid: false, error: 'IP addresses are not allowed. Use a domain name.' };
  }
  if (raw === 'localhost' || raw.endsWith('.localhost')) {
    return { valid: false, error: 'localhost is not a valid public domain.' };
  }
  if (raw.endsWith(`.${PLATFORM_BASE_DOMAIN}`) || raw === PLATFORM_BASE_DOMAIN) {
    return { valid: false, error: `Use the Challenge Subdomain option for *.${PLATFORM_BASE_DOMAIN}.` };
  }
  // Reject anything that looks like a URL with protocol/path/port/query
  if (/[/?:#]/.test(raw)) return { valid: false, error: 'Enter the domain name only — no paths, ports, or query strings.' };
  if (/^https?:\/\//.test(raw) || /^git:\/\//.test(raw)) {
    return { valid: false, error: 'Enter the domain name only — no protocol (https://, http://).' };
  }
  if (/:\d/.test(raw)) return { valid: false, error: 'Port numbers are not allowed in the domain name.' };
  // Each label: letters, digits, hyphens; no leading/trailing hyphen; 1-63 chars
  const labels = raw.split('.');
  if (labels.length < 2) {
    return { valid: false, error: 'Enter a fully-qualified domain (e.g. example.com).' };
  }
  for (const label of labels) {
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(label) && !/^[a-z0-9]$/.test(label)) {
      return { valid: false, error: `"${label}" is not a valid DNS label.` };
    }
    if (label.startsWith('-') || label.endsWith('-')) {
      return { valid: false, error: 'Domain labels cannot start or end with a hyphen.' };
    }
    if (label.length > 63) {
      return { valid: false, error: 'Each domain label must be 63 characters or fewer.' };
    }
  }
  return { valid: true, normalized: raw };
}

/**
 * Validate a Git repository URL. Must be a valid HTTPS GitHub repository URL.
 */
export function validateGitUrl(url: string): { valid: boolean; error?: string } {
  const u = String(url || '').trim();
  if (!u) return { valid: false, error: 'Git repository URL is required.' };
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Git URL must use HTTPS (https://).' };
    }
    if (!parsed.hostname.includes('github.com')) {
      return { valid: false, error: 'Git URL must point to a GitHub repository.' };
    }
    if (!parsed.pathname || parsed.pathname === '/') {
      return { valid: false, error: 'Git URL must include the repository path (e.g. /org/repo).' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Enter a valid HTTPS GitHub URL (e.g. https://github.com/org/repo.git).' };
  }
}