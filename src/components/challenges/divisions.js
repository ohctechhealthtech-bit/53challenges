import { DIVISIONS } from '@/lib/challenges-data';

// Division helpers for the entry flow. Divisions are sourced from the canonical
// DIVISIONS constant (single source of truth in challenges-data) so the wizard
// matches the pasted ParticipantSubmissionFlow without a separate entity.

export function getDivisions() {
  return DIVISIONS;
}

// Age at a reference date (defaults to today). Returns null for invalid input.
export function deriveAge(dob, refDateIso) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const ref = refDateIso ? new Date(refDateIso) : new Date();
  if (isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

// Resolve the division object for an entrant. NDI opt-in overrides age.
// Returns null when the entrant is too young (< 7) or age is unknown.
export function assignDivision(divisions, age, ndiOptIn) {
  const list = divisions && divisions.length ? divisions : DIVISIONS;
  const find = (slug) => list.find((d) => d.slug === slug);
  if (ndiOptIn) return find('ndi') || { slug: 'ndi', name: 'NDIs', tagline: 'NDI division' };
  if (age === null || age === undefined) return null;
  if (age < 7) return null;
  if (age <= 12) return find('children') || { slug: 'children', name: 'Children', tagline: 'Ages 7–12' };
  if (age <= 19) return find('teens') || { slug: 'teens', name: 'Teens', tagline: 'Ages 13–19' };
  return find('adults') || { slug: 'adults', name: 'Adults', tagline: '20+' };
}

export function divisionLabel(d) {
  if (!d) return '';
  return d.tagline ? `${d.name} · ${d.tagline}` : d.name;
}