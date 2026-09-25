/** Picks a suitable photo for a challenge template card. */
import { ACTIVITY_IMAGES } from '@/components/host/idea/ideaTileImages';

const KEYWORDS = [
  [/photo|film|video|digital|reel|snap/i, 'photography-film-digital'],
  [/music|dance|perform|sing|song|spotlight|talent/i, 'music-dance-performance'],
  [/writ|story|poem|idea|innovat|pitch/i, 'writing-ideas-innovation'],
  [/food|cook|bake|garden|grow|farm|community/i, 'food-farming-community'],
  [/outdoor|adventure|sport|walk|nature|explore/i, 'outdoor-adventure'],
  [/art|craft|draw|paint|make|design/i, 'art-craft-making'],
];

export function templateThumb(template) {
  // The template master's own card image always wins.
  if (template.image_url) return template.image_url;
  const text = [template.category, template.template_name, template.summary].filter(Boolean).join(' ');
  if (template.category && ACTIVITY_IMAGES[template.category]) return ACTIVITY_IMAGES[template.category];
  // Short category labels ("photography") still resolve to the right family.
  const cat = String(template.category || '').toLowerCase();
  const partial = cat && Object.keys(ACTIVITY_IMAGES).find((k) => k.includes(cat) || cat.includes(k.split('-')[0]));
  if (partial) return ACTIVITY_IMAGES[partial];
  const hit = KEYWORDS.find(([re]) => re.test(text));
  return ACTIVITY_IMAGES[hit ? hit[1] : 'not_sure'];
}