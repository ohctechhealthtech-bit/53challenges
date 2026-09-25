import { useEffect, useRef } from 'react';

const SWIPE_THRESHOLD = 50;
const COOLDOWN_MS = 400;

export default function useReelGestures(containerRef, step) {
  const lastRef = useRef(0);
  const startRef = useRef(null);
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const move = (dir) => {
      const now = Date.now();
      if (now - lastRef.current < COOLDOWN_MS) return;
      lastRef.current = now;
      stepRef.current(dir);
    };

    const onWheel = (e) => {
      if (e.target?.closest?.('input, textarea, [contenteditable="true"], [data-reel-no-swipe]')) return;
      e.preventDefault();
      if (Math.abs(e.deltaY) < 4 || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      move(e.deltaY > 0 ? 1 : -1);
    };

    const onTouchStart = (e) => {
      const t = e.touches[0];
      startRef.current = { x: t.clientX, y: t.clientY };
    };
    const onTouchMove = (e) => {
      if (!startRef.current) return;
      const t = e.touches[0];
      const dy = t.clientY - startRef.current.y;
      const dx = t.clientX - startRef.current.x;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10 && e.cancelable) e.preventDefault();
    };
    const onTouchEnd = (e) => {
      const start = startRef.current;
      startRef.current = null;
      const t = e.changedTouches?.[0];
      if (!start || !t) return;
      const dy = t.clientY - start.y;
      const dx = t.clientX - start.x;
      if (Math.abs(dx) > Math.abs(dy)) return;
      if (Math.abs(dy) < SWIPE_THRESHOLD) return;
      move(dy < 0 ? 1 : -1);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [containerRef]);
}