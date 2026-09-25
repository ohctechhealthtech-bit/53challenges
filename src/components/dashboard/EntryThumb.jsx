import { useEffect, useState } from 'react';
import { FileText, ImageOff } from 'lucide-react';
import {
  getDashboardCardImage,
  isValidImageUrl,
} from '@/lib/dashboardMedia';

/**
 * Square entry thumbnail used by the dashboard cards.
 * Picks the best image via getDashboardCardImage(challenge, entry):
 *   1. challenge banner/hero image
 *   2. entry direct image URL
 *   3. entry YouTube thumbnail
 *   4. styled fallback tile (gradient + category label)
 * If a chosen image fails to load (onError), it swaps to the styled
 * fallback tile instead of leaving a broken-image icon.
 */
export default function EntryThumb({ challenge, entry, size = 'h-20 w-20' }) {
  const media = getDashboardCardImage(challenge, entry);
  const [broken, setBroken] = useState(false);

  // Reset the broken flag whenever the resolved src changes.
  useEffect(() => {
    setBroken(false);
  }, [media?.src]);

  const cls = `${size} shrink-0 rounded-xl overflow-hidden ring-1 ring-slate-200`;

  const showImage = media.type === 'image' && !broken;

  if (showImage) {
    return (
      <img
        src={media.src}
        alt={entry?.title || 'Entry'}
        onError={() => setBroken(true)}
        className={`${cls} object-cover`}
      />
    );
  }

  // Styled fallback tile — never a bare icon placeholder.
  const categoryLabel = entry?.category
    ? String(entry.category).replace(/_/g, ' ')
    : 'Entry';
  const label = (entry?.title || entry?.challenge_title || 'No preview available').trim();

  return (
    <div
      className={`${cls} relative flex flex-col justify-between bg-gradient-to-br from-indigo-500 to-violet-600 p-2`}
      title={entry?.title || 'Entry'}
    >
      <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-white/85">
        {broken ? <ImageOff className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
        {categoryLabel}
      </span>
      <p className="line-clamp-4 text-[9px] font-semibold leading-tight text-white">
        {label}
      </p>
    </div>
  );
}

// Re-export so callers can validate without importing the lib directly.
export { isValidImageUrl };