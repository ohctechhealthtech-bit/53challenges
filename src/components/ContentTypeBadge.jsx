/** Small label showing who owns a challenge's content. */
import { contentTypeLabel, normalizeContentType } from '@/lib/contentType';

export default function ContentTypeBadge({ value, className = '' }) {
  const v = normalizeContentType(value);
  const tone = v === 'host_managed'
    ? 'bg-amber-500/15 text-amber-400'
    : 'bg-sky-500/15 text-sky-400';
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone} ${className}`}>
      {contentTypeLabel(v)}
    </span>
  );
}