// Frontend mirror of base44/shared/subdomainValidation.ts — kept in sync
// so the form validates before hitting the backend.

export const RESERVED_SLUGS = [
  'www', 'admin', 'api', 'app', 'mail', 'smtp', 'auth', 'login',
  'dashboard', 'dev', 'test', 'staging', 'cdn', 'assets',
  'ftp', 'localhost', 'portal', 'host', 'judge', 'sponsor', 'guardian',
];

const PLATFORM_BASE_DOMAIN = '53challenges.com';

export function normalizeSlug(slug) {
  return String(slug || '').toLowerCase().trim();
}

export function validateSlug(slug) {
  const s = normalizeSlug(slug);
  if (!s) return { valid: false, error: 'Subdomain slug is required' };
  if (RESERVED_SLUGS.includes(s)) return { valid: false, error: 'This name is reserved and cannot be used' };
  if (s.length < 2) return { valid: false, error: 'Slug must be at least 2 characters' };
  if (s.length > 63) return { valid: false, error: 'Slug must be 63 characters or fewer' };
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s) && s.length !== 1) {
    return { valid: false, error: 'Only lowercase letters, numbers, and hyphens are allowed' };
  }
  if (s.startsWith('-')) return { valid: false, error: 'Slug cannot start with a hyphen' };
  if (s.endsWith('-')) return { valid: false, error: 'Slug cannot end with a hyphen' };
  return { valid: true };
}

export function validateFullDomain(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return { valid: false, error: 'Full domain name is required' };
  if (raw !== String(input).trim()) {
    return { valid: false, error: 'Domain name must not contain leading or trailing whitespace' };
  }
  if (/\s/.test(raw)) return { valid: false, error: 'Domain name must not contain whitespace' };
  if (/^\d+\.\d+\.\d+\.\d+$/.test(raw)) {
    return { valid: false, error: 'IP addresses are not allowed. Use a domain name' };
  }
  if (raw === 'localhost' || raw.endsWith('.localhost')) {
    return { valid: false, error: 'localhost is not a valid public domain' };
  }
  if (raw.endsWith(`.${PLATFORM_BASE_DOMAIN}`) || raw === PLATFORM_BASE_DOMAIN) {
    return { valid: false, error: `Use the Challenge Subdomain option for *.${PLATFORM_BASE_DOMAIN}` };
  }
  if (/[/?:#]/.test(raw)) return { valid: false, error: 'Enter the domain name only — no paths, ports, or query strings' };
  if (/^https?:\/\//.test(raw) || /^git:\/\//.test(raw)) {
    return { valid: false, error: 'Enter the domain name only — no protocol' };
  }
  if (/:\d/.test(raw)) return { valid: false, error: 'Port numbers are not allowed in the domain name' };
  const labels = raw.split('.');
  if (labels.length < 2) {
    return { valid: false, error: 'Enter a fully-qualified domain (e.g. example.com)' };
  }
  for (const label of labels) {
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(label) && !/^[a-z0-9]$/.test(label)) {
      return { valid: false, error: `"${label}" is not a valid DNS label` };
    }
    if (label.startsWith('-') || label.endsWith('-')) {
      return { valid: false, error: 'Domain labels cannot start or end with a hyphen' };
    }
  }
  return { valid: true, normalized: raw };
}

export function validateGitUrl(url) {
  const u = String(url || '').trim();
  if (!u) return { valid: false, error: 'Git repository URL is required' };
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Git URL must use HTTPS (https://)' };
    }
    if (!parsed.hostname.includes('github.com')) {
      return { valid: false, error: 'Git URL must point to a GitHub repository' };
    }
    if (!parsed.pathname || parsed.pathname === '/') {
      return { valid: false, error: 'Git URL must include the repository path (e.g. /org/repo)' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Enter a valid HTTPS GitHub URL (e.g. https://github.com/org/repo.git)' };
  }
}

export function validatePemCert(content) {
  if (!content || !content.includes('-----BEGIN CERTIFICATE-----')) {
    return { valid: false, error: 'File must contain a certificate (-----BEGIN CERTIFICATE-----)' };
  }
  return { valid: true };
}

export function validatePemKey(content) {
  if (!content) return { valid: false, error: 'Private key file is empty' };
  if (!content.includes('-----BEGIN PRIVATE KEY-----') && !content.includes('-----BEGIN RSA PRIVATE KEY-----')) {
    return { valid: false, error: 'File must contain a private key (-----BEGIN PRIVATE KEY----- or -----BEGIN RSA PRIVATE KEY-----)' };
  }
  return { valid: true };
}

// Detects a challenge subdomain from the browser hostname.
// Returns the slug (e.g. "dance") or null when on the main site / reserved / localhost.
export function getChallengeSubdomain() {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname;
  if (!hostname) return null;
  // Skip localhost, IP addresses, and the Base44 preview domain
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.endsWith('.base44.app')) return null;
  const parts = hostname.split('.');
  if (parts.length < 3) return null;
  const sub = parts[0].toLowerCase();
  if (RESERVED_SLUGS.includes(sub)) return null;
  return sub;
}

/**
 * Absolute URL to the same path on the main site, for use on a challenge
 * subdomain where an in-app <Link> would stay on the subdomain. The apex is
 * derived by dropping the subdomain label rather than being configured, so it
 * stays correct on any base domain. Returns '' when not on a subdomain, so
 * callers can fall back to normal in-app routing.
 */
export function mainSiteUrl(path = '/') {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  if (!getChallengeSubdomain()) return '';
  const apex = host.split('.').slice(1).join('.');
  return `${window.location.protocol}//${apex}${path.startsWith('/') ? path : `/${path}`}`;
}
