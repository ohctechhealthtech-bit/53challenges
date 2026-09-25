const LABELS = {
  'art-craft-making': 'Art, craft & making', art_craft: 'Art, craft & making',
  'food-farming-community': 'Food, farming & community', food_community: 'Food, farming & community',
  'music-dance-performance': 'Music, dance & performance', music_performance: 'Music, dance & performance',
  'outdoor-adventure': 'Outdoor & adventure', outdoor: 'Outdoor & adventure',
  'photography-film-digital': 'Photography, film & digital', photo_film: 'Photography, film & digital',
  'writing-ideas-innovation': 'Writing, ideas & innovation', writing_ideas: 'Writing, ideas & innovation',
  children: 'Kids (under 13)', under_13: 'Kids (under 13)',
  teens: 'Teens (13–17)', ages_13_to_17: 'Teens (13–17)',
  adults: 'Adults (18+)', adults_18_plus: 'Adults (18+)',
  seniors: 'Seniors (65+)', seniors_65_plus: 'Seniors (65+)',
  all_ages: 'Everyone, all ages',
  school: 'School or education setting', workplace: 'Workplace or organisation',
  community: 'Local community', public: 'Open to the public',
  under_50: 'Under 50 people', up_to_50: 'Under 50 people',
  '50_250': '50 – 250 people', '250_1000': '250 – 1,000 people', '1000_plus': 'More than 1,000 people',
  single: 'A one-off challenge', one_off: 'A one-off challenge',
  series: 'A short series', annual: 'An ongoing annual programme',
  individual: 'Individual', individual_host: 'Individual host',
  business: 'Business or brand', community_group: 'School or community group',
  self_service: 'Self-service', supported: 'Supported', fully_managed: 'Fully managed',
  local: 'Local', state: 'State-wide', national: 'National', global: 'Global',
};

const sentence = (s) =>
  s.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\w/, (c) => c.toUpperCase());

export function humanizeToken(raw) {
  if (raw == null) return '';
  const key = String(raw).trim();
  if (!key) return '';
  if (LABELS[key]) return LABELS[key];
  if (LABELS[key.toLowerCase()]) return LABELS[key.toLowerCase()];
  return /^[a-z0-9]+([-_][a-z0-9]+)+$/i.test(key) ? sentence(key) : key;
}

export function humanize(value) {
  if (!value) return '';
  return String(value)
    .split(/\s*[·,]\s*/)
    .map(humanizeToken)
    .filter(Boolean)
    .join(' · ');
}

export function humanizeNotes(notes) {
  if (!notes) return '';
  return String(notes)
    .split('\n')
    .map((line) => {
      const m = line.match(/^([^:]+):\s*(.*)$/);
      if (!m) return line;
      const [, label, val] = m;
      if (/^source$/i.test(label.trim())) return line;
      return `${label}: ${humanize(val)}`;
    })
    .join('\n');
}