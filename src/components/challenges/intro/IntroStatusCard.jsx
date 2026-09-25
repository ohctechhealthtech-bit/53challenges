import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Users, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

const fmt = (d) => { try { return format(new Date(d), 'd MMM yyyy, h:mm a'); } catch { return ''; } };

function useDaysLeft(deadline) {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (!deadline) { setLeft(null); return; }
    const tick = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      setLeft(diff <= 0 ? 0 : Math.floor(diff / 86400000));
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [deadline]);
  return left;
}

/** Floating status card: current stage, countdown and the stage's primary action. */
export default function IntroStatusCard({ statusLabel, deadline, prize, entriesCount, cta, phase }) {
  const days = useDaysLeft(deadline);
  const isClosed = phase === 'closed';

  return (
    <div className="w-full max-w-xs rounded-2xl border border-white/15 bg-black/55 p-5 text-white shadow-2xl backdrop-blur-md">
      <p className="mx-auto w-fit rounded-full bg-emerald-500/25 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/40">
        {statusLabel}
      </p>
      {days !== null && !isClosed && (
        <div className="mt-4 text-center">
          <p className="font-heading text-5xl font-extrabold tabular-nums">{String(days).padStart(2, '0')}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-white/60">Days left</p>
          {deadline && <p className="mt-1 text-[11px] text-white/50">Ends {fmt(deadline)}</p>}
        </div>
      )}
      {isClosed && (
        <div className="mt-4 text-center">
          <p className="text-sm font-semibold text-white/80">Voting has closed — results coming soon</p>
        </div>
      )}
      <div className="mt-4 space-y-3 border-t border-white/10 pt-4 text-sm">
        <p className="flex items-center gap-2.5">
          <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
          <span><b>{prize}</b><span className="block text-[11px] text-white/55">Winner prize</span></span>
        </p>
        <p className="flex items-center gap-2.5">
          <Users className="h-4 w-4 shrink-0 text-white/70" />
          <span><b>{entriesCount}</b><span className="block text-[11px] text-white/55">Entries</span></span>
        </p>
      </div>
      {cta ? (
        <Link
          to={cta.to}
          className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-500 px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5"
        >
          {cta.label} <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white/60">
          Entries paused
        </div>
      )}
    </div>
  );
}