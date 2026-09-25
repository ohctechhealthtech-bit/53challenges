// One entry in the Judge list — clicking the media opens the full-screen reels feed.
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import ReelMedia from '@/components/judge/reels/ReelMedia';
import JudgeScoreBox from '@/components/judge/reels/JudgeScoreBox';

const label = (c) => (c || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

export default function JudgeEntryCard({ row, index, total, roundId, criteria, onScored, onOpenPreview }) {
  const sub = row.entry;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-lg"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          {sub.challenge_title && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              <Trophy className="h-3.5 w-3.5" /> {sub.challenge_title}
            </span>
          )}
          <span className="shrink-0 text-xs font-semibold text-stone-400">{index + 1}/{total}</span>
        </div>

        <div className="mt-3 min-w-0">
          <h3 className="text-lg font-bold leading-snug text-stone-900">{sub.title}</h3>
          <p className="mt-0.5 text-base text-stone-600">Entry #{String(sub.id).slice(-4)}</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {sub.state && (
            <span className="rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
              {label(sub.state)}
            </span>
          )}
          <span className="rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800">
            {label(sub.category) || 'Creative'}
          </span>
          {sub.division_name && (
            <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-800">
              {label(sub.division_name)}
            </span>
          )}
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpenPreview?.(index)}
          onKeyDown={(e) => { if (e.key === 'Enter') onOpenPreview?.(index); }}
          title="Open full-screen preview"
          className="mt-4 flex max-h-[420px] min-h-[220px] cursor-zoom-in items-center justify-center overflow-hidden rounded-xl bg-stone-900"
        >
          <div className="pointer-events-none flex h-full w-full items-center justify-center">
            <ReelMedia entry={sub} />
          </div>
        </div>

        {sub.description && (
          <p className="mt-3 line-clamp-2 text-base text-stone-600">{sub.description}</p>
        )}

        <JudgeScoreBox row={row} roundId={roundId} criteria={criteria} onSubmitted={onScored} />
      </div>
    </motion.article>
  );
}