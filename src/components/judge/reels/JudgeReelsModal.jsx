// "Judge the reel" — a full-screen light page listing your unscored entries.
// Clicking an entry's media opens the reels feed.
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { judgeApi, pickList } from '@/lib/judgeApi';
import { PanelLoading, PanelError } from '@/components/judge/PanelStates';
import JudgeCategoryTabs from '@/components/judge/reels/JudgeCategoryTabs';
import JudgeEntryCard from '@/components/judge/reels/JudgeEntryCard';
import JudgeReelsFeed from '@/components/judge/reels/JudgeReelsFeed';

const isScored = (e) =>
  !!e.my_score || (e.judge_status || '').toString().toLowerCase() === 'scored';

export default function JudgeReelsModal({ open, roundId, criteria, onClose }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all');
  const [saved, setSaved] = useState({});
  const [previewIndex, setPreviewIndex] = useState(null);

  const load = useCallback(() => {
    setError('');
    setEntries(null);
    judgeApi('judge-queue', { round_id: roundId })
      .then((d) => setEntries(pickList(d, ['entries', 'queue', 'rows', 'items'])))
      .catch((e) => setError(e.message));
  }, [roundId]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const categories = useMemo(
    () => [...new Set((entries || []).map((e) => e.category).filter(Boolean))],
    [entries],
  );

  const rows = useMemo(() => (entries || [])
    .filter((e) => category === 'all' || e.category === category)
    .map((e) => ({
      entry: e,
      scored: isScored(e) || saved[String(e.id)] !== undefined,
      savedTotal: saved[String(e.id)] ?? e.my_score?.total ?? null,
    })), [entries, category, saved]);

  const onSubmitted = (entryId, total) =>
    setSaved((prev) => ({ ...prev, [String(entryId)]: total }));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex h-screen w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-[#FDF8F1] p-0 [&>button]:bg-white [&>button]:p-1.5 [&>button]:opacity-100 [&>button]:shadow-sm [&>button]:rounded-full">
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-4 pb-6 pt-10 text-center sm:px-8">
            <DialogTitle className="text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
              Judge
            </DialogTitle>
            <p className="mt-2 text-base text-stone-600 sm:text-lg">
              Watch your unscored entries and score them as you go
            </p>
          </div>

          <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-16 sm:px-8">
            {error ? (
              <PanelError message={error} onRetry={load} />
            ) : !entries ? (
              <div className="text-stone-600"><PanelLoading label="Loading your judging queue…" /></div>
            ) : (
              <>
                <JudgeCategoryTabs categories={categories} value={category} onChange={setCategory} />
                {rows.length === 0 ? (
                  <div className="rounded-xl border border-stone-200 bg-white p-12 text-center text-stone-600">
                    You have scored every entry in this view. Nothing left to judge.
                  </div>
                ) : (
                  rows.map((row, i) => (
                    <JudgeEntryCard
                      key={row.entry.id}
                      row={row}
                      index={i}
                      total={rows.length}
                      roundId={roundId}
                      criteria={criteria}
                      onScored={onSubmitted}
                      onOpenPreview={setPreviewIndex}
                    />
                  ))
                )}
              </>
            )}
          </div>
        </div>

        {previewIndex !== null && (
          <JudgeReelsFeed
            rows={rows}
            startIndex={previewIndex}
            roundId={roundId}
            criteria={criteria}
            onSubmitted={onSubmitted}
            onClose={() => setPreviewIndex(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}