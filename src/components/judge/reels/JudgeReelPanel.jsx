// One full-viewport reel panel: the work, its details, and the scoring card.
import ReelMedia from '@/components/judge/reels/ReelMedia';
import JudgeScoreBox from '@/components/judge/reels/JudgeScoreBox';

export default function JudgeReelPanel({ row, index, total, active, roundId, criteria, onScored, onSubmitted }) {
  const entry = row.entry;

  return (
    <section
      data-panel-index={index}
      className="relative flex h-full w-full shrink-0 snap-start items-center justify-center bg-black"
      style={{ scrollSnapAlign: 'start' }}
    >
      {active ? (
        <>
          <ReelMedia entry={entry} />

          <div
            className="absolute bottom-0 left-0 right-0 max-h-full overflow-y-auto overscroll-contain bg-gradient-to-t from-black via-black/80 to-transparent px-4 pt-10"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
          >
            <div className="mx-auto max-w-2xl">
              <div className="flex items-center gap-2">
                {entry.challenge_title && (
                  <span className="rounded-full bg-orange-600/90 px-2.5 py-1 text-xs font-semibold text-white">
                    🏆 {entry.challenge_title}
                  </span>
                )}
                {row.scored && row.savedTotal != null && (
                  <span className="rounded-full bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white">
                    Scored — {Number(row.savedTotal).toFixed(1)}/100
                  </span>
                )}
                <span className="ml-auto text-[11px] font-medium text-white/60">{index + 1} / {total}</span>
              </div>
              <h3 className="mt-2 truncate text-xl font-bold text-white">{entry.title}</h3>
              <p className="text-sm text-stone-300">
                by {entry.creator_name || entry.user_name || 'Entrant'}{entry.state ? ` · ${entry.state}` : ''}
              </p>

              <div className="mt-3 rounded-2xl bg-white px-4 pb-3 shadow-xl">
                <JudgeScoreBox
                  row={row}
                  roundId={roundId}
                  criteria={criteria}
                  onScored={onScored}
                  onSubmitted={onSubmitted}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="h-full w-full" aria-hidden="true" />
      )}
    </section>
  );
}