import { Mountain, Palette, Music, Camera, PenLine, Sprout, Trophy } from 'lucide-react';

const ICONS = {
  'outdoor-adventure': Mountain,
  'art-craft-making': Palette,
  'music-dance-performance': Music,
  'photography-film-digital': Camera,
  'writing-ideas-innovation': PenLine,
  'food-farming-community': Sprout,
};

/**
 * Renders a consistent SVG icon for a category slug.
 * Falls back to a Trophy icon for unknown slugs.
 */
export default function CategoryIcon({ slug, className }) {
  const Icon = ICONS[slug] || Trophy;
  return <Icon className={className} />;
}