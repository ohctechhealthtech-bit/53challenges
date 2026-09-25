// "Judge the reel" — full-screen, one entry per viewport height.
// Wheel / swipe / arrow keys move EXACTLY one panel per gesture
// (cooldown-guarded, ignored inside inputs); auto-advance ~700ms after a
// confirmed save; summary card at the end; Esc or the X closes.
import { useEffect, useRef, useState, useCallback } from 'react';
import { X, PartyPopper, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { judgeApi, pickList } from '@/lib/judgeApi';
import { PanelLoading, PanelError } from '@/components/judge/PanelStates';
import ReelEntryPanel from '@/components/judge/ReelEntryPanel';

const GESTURE_COOLDOWN_MS = 800;
const AUTO_ADVANCE_MS = 700;

export default function JudgeReel({ roundId, category, criteria, onClose, onScored }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [scoredTotals, setScoredTotals] = useState({});
  const cooldownRef = useRef(false);
  const touchStartY = useRef(null);
  const indexRef = useRef(0);
  const countRef = useRef(0);

  const load = useCallback(() => {
    setError('');
    judgeApi('judge-queue', { round_id: roundId, ...(category ? { category } : {}) })
      .then((d) => setEntries(pickList(d, ['entries', 'queue', 'rows', 'items'])))
      .catch((e) => setError(e.message));
  }, [roundId, category]);
  useEffect(load, [load]);

  const panelCount = (entries?.length || 0) + 1; // + summary card
  indexRef.current = index;
  countRef.current = panelCount;

  const step = useCallback((dir) => {
    if (cooldownRef.current) return;
    const next = Math.min(Math.max(indexRef.current + dir, 0), countRef.current - 1);
    if (next === indexRef.current) return;
    cooldownRef.current = true;
    setIndex(next);
    setTimeout(() => { cooldownRef.current = false; }, GESTURE_COOLDOWN_MS);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.target && e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onClose]);

  const insideInput = (target) => !!(target && target.closest && target.closest('input, textarea, select'));

  const onWheel = (e) => {
    if (insideInput(e.target)) return;
    if (Math.abs(e.deltaY) < 10) return;
    step(e.deltaY > 0 ? 1 : -1);
  };

  const onTouchStart = (e) => {
    if (insideInput(e.target)) { touchStartY.current = null; return; }
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e) => {
    if (touchStartY.current === null) return;
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    touchStartY.current = null;
    if (Math.abs(diff) < 50) return;
    step(diff > 0 ? 1 : -1);
  };

  const handleScored = (entryId, total) => {
    setScoredTotals((prev) => ({ ...prev, [String(entryId)]: total }));
    onScored?.(entryId);
    setTimeout(() => step(1), AUTO_ADVANCE_MS);
  };

  const scoredCount = Object.keys(scoredTotals).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0a0a0c]"
      role="dialog"
      aria-modal="true"
      aria-label="Judge the reel"
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close the reel"
        className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      {error ? (
        <div className="mx-auto max-w-md pt-24"><PanelError message={error} onRetry={load} /></div>
      ) : !entries ? (
        <div className="pt-24 text-white"><PanelLoading label="Loading your judging queue…" /></div>
      ) : (
        <div className="h-full overflow-hidden">
          <div
            className="h-full transition-transform duration-500 ease-out"
            style={{ transform: `translateY(-${index * 100}%)` }}
          >
            {entries.map((e, i) => {
              const saved = scoredTotals[String(e.id)];
              const scored = saved !== undefined || !!e.my_score ||
                (e.judge_status || '').toString().toLowerCase() === 'scored';
              return (
                <ReelEntryPanel
                  key={e.id}
                  entry={e}
                  position={i + 1}
                  total={entries.length}
                  roundId={roundId}
                  criteria={criteria}
                  scored={scored}
                  savedTotal={saved ?? e.my_score?.total}
                  onSubmitted={handleScored}
                />
              );
            })}

            {/* Summary card */}
            <div className="flex h-full w-full items-center justify-center p-4">
              <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white">
                <PartyPopper className="mx-auto h-10 w-10 text-gold" />
                <h2 className="mt-4 font-heading text-xl font-bold">
                  {entries.length === 0 ? 'Nothing left to judge' : "That's the whole queue!"}
                </h2>
                <p className="mt-2 text-sm text-white/60">
                  You scored {scoredCount} {scoredCount === 1 ? 'entry' : 'entries'} this session
                  {entries.length > 0 && ` out of ${entries.length} in the queue`}.
                </p>
                <Button className="mt-5" onClick={onClose}>Back to the control room</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {entries && entries.length > 0 && (
        <div className="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
          <button type="button" aria-label="Previous entry" onClick={() => step(-1)} className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20">
            <ChevronUp className="h-5 w-5" />
          </button>
          <button type="button" aria-label="Next entry" onClick={() => step(1)} className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20">
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}