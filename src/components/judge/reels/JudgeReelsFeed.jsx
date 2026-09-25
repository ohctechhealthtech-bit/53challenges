// Instagram-Reels style judging feed. Only the X, Escape or the final
// Close button close it.
import { useEffect, useRef, useState, useCallback } from 'react';
import { X, ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react';
import JudgeReelPanel from '@/components/judge/reels/JudgeReelPanel';
import useReelGestures from '@/components/judge/reels/useReelGestures';

export default function JudgeReelsFeed({ rows, startIndex = 0, onClose, roundId, criteria, onSubmitted }) {
  const containerRef = useRef(null);
  const [current, setCurrent] = useState(startIndex);
  const total = rows.length;
  const panelCount = total + 1; // + closing summary card

  const scrollToIndex = useCallback((idx) => {
    const el = containerRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(idx, panelCount - 1));
    el.scrollTo({ top: next * el.clientHeight, behavior: 'smooth' });
  }, [panelCount]);

  useReelGestures(containerRef, useCallback((dir) => {
    const el = containerRef.current;
    if (!el) return;
    const at = Math.round(el.scrollTop / el.clientHeight);
    scrollToIndex(at + dir);
  }, [scrollToIndex]));

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTo({ top: startIndex * el.clientHeight });
  }, [startIndex]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setCurrent(Number(visible.target.dataset.panelIndex));
      },
      { root: el, threshold: [0.55, 0.8] },
    );
    el.querySelectorAll('[data-panel-index]').forEach((p) => observer.observe(p));
    return () => observer.disconnect();
  }, [panelCount]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.target?.tagName === 'INPUT') return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); scrollToIndex(current + 1); }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); scrollToIndex(current - 1); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [current, scrollToIndex, onClose]);

  if (!total) return null;
  const cur = rows[Math.min(current, total - 1)];
  const onSummary = current >= total;

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <button
        onClick={onClose}
        aria-label="Close viewer"
        className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="absolute left-1/2 top-4 z-20 max-w-[70vw] -translate-x-1/2 text-center">
        {onSummary ? (
          <p className="text-sm font-semibold text-white">All entries reviewed</p>
        ) : (
          <>
            <p className="truncate text-sm font-semibold text-white">{cur?.entry?.title}</p>
            <p className="truncate text-xs text-white/70">by {cur?.entry?.creator_name || cur?.entry?.user_name || 'Entrant'}</p>
            <p className="mt-0.5 text-[11px] font-medium text-white/50">{current + 1} / {total}</p>
          </>
        )}
      </div>

      <div className="absolute bottom-28 right-4 z-20 hidden flex-col gap-2 rounded-full border border-white/10 bg-black/40 p-1.5 backdrop-blur-sm md:flex">
        <button
          onClick={() => scrollToIndex(current - 1)} disabled={current === 0} title="Previous entry"
          className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/25 disabled:opacity-30"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
        <button
          onClick={() => scrollToIndex(current + 1)} disabled={current === panelCount - 1} title="Next entry"
          className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/25 disabled:opacity-30"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="h-full w-full overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:hidden"
        style={{
          scrollSnapType: 'y mandatory',
          overscrollBehavior: 'contain',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {rows.map((row, i) => (
          <JudgeReelPanel
            key={row.entry.id}
            row={row}
            index={i}
            total={total}
            active={Math.abs(i - current) <= 1}
            roundId={roundId}
            criteria={criteria}
            onSubmitted={onSubmitted}
            onScored={() => scrollToIndex(i + 1)}
          />
        ))}

        <section
          data-panel-index={total}
          className="flex h-full w-full shrink-0 snap-start flex-col items-center justify-center px-6 text-center"
          style={{ scrollSnapAlign: 'start' }}
        >
          <CheckCircle2 className="mb-4 h-14 w-14 text-teal-400" />
          <h3 className="text-2xl font-bold text-white">All entries scored</h3>
          <p className="mt-2 max-w-sm text-sm text-white/70">
            Scroll back up any time to revise a score — your latest values are saved automatically.
          </p>
          <button
            onClick={onClose}
            className="mt-6 rounded-full bg-white px-8 py-3 text-sm font-semibold text-stone-900 hover:bg-stone-200"
          >
            Close
          </button>
        </section>
      </div>
    </div>
  );
}