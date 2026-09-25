/**
 * Six large photo category tiles (3x2 on desktop) opening the guided discovery flow.
 */
import { CATEGORY_OPTIONS } from '@/components/host/applySteps';
import { CATEGORY_IMAGES } from '@/components/host/apply/tileImages';
import PhotoTile from '@/components/host/apply/PhotoTile';

// Literal classes so Tailwind keeps them in the build.
const CATEGORY_BORDERS = {
  'art-craft-making': 'border-rose-400',
  'food-farming-community': 'border-amber-400',
  'music-dance-performance': 'border-purple-400',
  'outdoor-adventure': 'border-emerald-400',
  'photography-film-digital': 'border-blue-400',
  'writing-ideas-innovation': 'border-teal-400',
};

export default function CategoryTiles({ value, onChange }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup">
      {CATEGORY_OPTIONS.map((c) => (
        <PhotoTile
          key={c.value}
          image={CATEGORY_IMAGES[c.value]}
          label={c.label}
          description={c.description}
          active={value === c.value}
          onClick={() => onChange(c.value)}
          aspect="aspect-[4/3]"
          accentBorder={CATEGORY_BORDERS[c.value] || 'border-[#1677C8]'}
        />
      ))}
    </div>
  );
}