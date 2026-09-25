/**
 * A single full-bleed photo answer tile: image fills the frame, dark gradient
 * keeps the label legible, tick badge confirms selection.
 */
import { Check } from 'lucide-react';

export default function PhotoTile({
  image,
  label,
  description,
  active,
  onClick,
  multi = false,
  aspect = 'aspect-[3/2]',
  accentBorder = 'border-[#1677C8]',
  badge,
}) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={active}
      onClick={onClick}
      className={`group relative flex ${aspect} w-full flex-col justify-end overflow-hidden rounded-3xl text-left transition-all hover:-translate-y-0.5 ${
        active ? `border-2 ${accentBorder} shadow-md` : 'border border-border shadow-sm'
      }`}
    >
      <img
        src={image}
        alt={label}
        loading="lazy"
        className={`absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105 ${
          active ? 'scale-[1.02]' : ''
        }`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" aria-hidden="true" />
      {active && (
        <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow">
          <Check className="h-4 w-4 text-[#102A43]" aria-hidden="true" />
        </span>
      )}
      {badge && <span className="absolute left-3 top-3 z-10">{badge}</span>}
      <span className="relative z-10 p-5">
        <span className="block font-heading text-lg font-bold leading-tight text-white sm:text-xl">{label}</span>
        {description && (
          <span className="mt-1 block text-sm leading-snug text-white/90">{description}</span>
        )}
      </span>
    </button>
  );
}