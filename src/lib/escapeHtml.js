/**
 * Escapes a value for use inside HTML.
 *
 * Built for email bodies, which are assembled here as HTML strings. The host
 * request chat interpolated the applicant's own contact_name and
 * working_title straight into one — so an applicant could put markup in their
 * proposal and receive it back rendered, inside a message from 53 Challenges,
 * which is a convincing thing to screenshot and forward to someone else.
 *
 * The admin's own message went in unescaped too. That one is less alarming,
 * but it means a message containing "<3" or "a < b" renders as broken markup
 * rather than as what they typed.
 *
 * Ampersand first, or the escapes escape each other.
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escaped, with newlines becoming line breaks. For a typed message. */
export function escapeHtmlWithBreaks(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}
