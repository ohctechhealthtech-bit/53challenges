// Shared labels and helpers for the Discover & Vote page.
//
// Category keys are this app's canonical hyphenated slugs (see
// challenges-data CATEGORIES), not the underscored ids the parent app uses —
// an entry's `category` arrives normalised to these, so the emoji lookup has
// to be keyed the same way or every card falls back to the sparkle.
import React from 'react';

export const STATE_NAMES = {
  QLD: 'Queensland',
  NSW: 'New South Wales',
  VIC: 'Victoria',
  SA: 'South Australia',
  WA: 'Western Australia',
  TAS: 'Tasmania',
  ACT: 'Australian Capital Territory',
  NT: 'Northern Territory',
};

export const CATEGORY_EMOJIS = {
  'visual-arts': '🎨',
  'photography': '📸',
  'writing-storytelling': '📖',
  'digital-creativity': '💻',
  'performance-voice': '🎤',
  'dance': '💃',
  'open-experimental': '✨',
};

/** Sort ids are this app's own — the page's sorter switches on them. */
export const SORT_OPTIONS = [
  { id: '-community_votes', label: 'Most Voted' },
  { id: '-submitted_at', label: 'Newest' },
  { id: 'alphabetical', label: 'Alphabetical' },
];

// Regex-special characters, listed without a backslash literal in the source.
// This file is written through a shell that collapses doubled backslashes, so
// an escaper spelled the usual way arrived with its backslash missing and
// threw "Nothing to repeat" the first time someone searched for "c++".
const BACKSLASH = String.fromCharCode(92);
const REGEX_SPECIALS = '.*+?^${}()|[]' + BACKSLASH;

function escapeRegExp(s) {
  let out = '';
  for (const ch of String(s)) out += REGEX_SPECIALS.includes(ch) ? BACKSLASH + ch : ch;
  return out;
}

/** Wraps parts of `text` matching any search word in a soft yellow highlight. */
export function highlightMatch(text, search) {
  if (!text || !search?.trim()) return text;
  const words = search.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (!words.length) return text;
  const regex = new RegExp(`(${words.join('|')})`, 'gi');
  const parts = String(text).split(regex);
  return parts.map((part, i) =>
    regex.test(part) && part.match(regex)?.[0] === part ? (
      <mark key={i} className="rounded-sm bg-yellow-200/80 px-0.5 text-inherit">{part}</mark>
    ) : (
      part
    )
  );
}
