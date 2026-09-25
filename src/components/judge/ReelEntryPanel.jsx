// One reel panel: centred header, media filling the panel height, overlaid
// entry details and the white scoring card.
import { CheckCircle2 } from 'lucide-react';
import EntryMediaView from '@/components/judge/EntryMediaView';
import ReelScoreCard from '@/components/judge/ReelScoreCard';

const titleCase = (value) =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (ch) => ch.toUpperCase());

export default function ReelEntryPanel({ entry, position, total, roundId, criteria, scored, savedTotal, onSubmitted }) {
  const author = entry.participant_display_name || entry.entrant_label || entry.creator_label || entry.blind_name || 'Entrant';
  const challenge = entry.challenge_title || entry.round_title || 'Challenge';
  const category = entry.category ? titleCase(entry.category) : '';
  const title = entry.title || 'Untitled entry';

  return (
    <div className="flex h-full w-full flex-col items-center justify-start bg-[#0a0a0c] px-4 pb-4 pt-4">
      <div className="text-center">
        <p className="font-heading text-sm font-bold text-white">🏆 {challenge}</p>
        <p className="mt-0.5 text-xs text-white/50">
          {title} · by {author}
        </p>
        <p className="mt-0.5 text-xs font-semibold text-white/40">{position} / {total}</p>
      </div>

      <div className="relative mt-3 flex min-h-0 w-full max-w-3xl flex-1 items-center justify-center overflow-hidden rounded-xl">
        <EntryMediaView entry={entry} fit="cover" className="h-full w-full" />

        {/* Entry details + score card overlaid across the bottom of the media */}
        <div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-4 pt-16"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-bold text-white">
              🏆 {titleCase(challenge)}
            </span>
            {category && (
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90">
                {category}
              </span>
            )}
            {scored && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/20 px-2.5 py-1 text-[11px] font-bold text-teal-300">
                <CheckCircle2 className="h-3 w-3" /> Scored — {savedTotal ?? '—'}/100
              </span>
            )}
          </div>

          <p className="mt-2 font-heading text-xl font-extrabold leading-tight text-white sm:text-2xl">
            {title}
          </p>
          <p className="mt-0.5 text-sm text-white/70">
            by {author}{entry.state ? ` · ${entry.state}` : ''}
          </p>
          {entry.description && (
            <p className="mt-1 line-clamp-2 text-xs text-white/50">{entry.description}</p>
          )}

          <div className="-mx-4 mt-3">
            <ReelScoreCard
              entry={entry}
              roundId={roundId}
              criteria={criteria}
              scored={scored}
              savedTotal={savedTotal}
              onSubmitted={onSubmitted}
            />
          </div>
        </div>
      </div>
    </div>
  );
}