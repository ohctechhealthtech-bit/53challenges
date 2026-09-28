/**
 * An entrant-supplied link, or null when it is not safe to render as an href.
 *
 * Only http and https pass. A `javascript:` URL in an href executes on click,
 * and these links are opened by admins from the moderation queue — the one
 * place where the person clicking has the most authority and the content is
 * least trusted. `target="_blank" rel="noreferrer"` does nothing about it.
 *
 * `data:` and `blob:` are refused for the same reason: they render
 * attacker-controlled content on our origin's terms.
 */
export function safeExternalUrl(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? trimmed : null;
  } catch {
    // Not an absolute URL. A relative one is not an external link, and
    // guessing a scheme for it is how "evil.com" becomes a live href.
    return null;
  }
}
