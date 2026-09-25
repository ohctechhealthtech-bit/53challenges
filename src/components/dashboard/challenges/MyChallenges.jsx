import { Link } from 'react-router-dom';
import { Heart, ChevronRight, ArrowRight } from 'lucide-react';
import EntryThumb from '@/components/dashboard/EntryThumb';

const RED = '#f15249';

const STATUS_STYLES = {
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};

/** My Challenges sub-tab: the entries this user has submitted and how they're going. */
export default function MyChallenges({ entries }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm text-slate-500">You haven't entered a challenge yet.</p>
        <Link
          to="/challenges"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white"
          style={{ backgroundColor: RED }}
        >
          Find a challenge <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {entries.map((e) => (
        <Link
          key={e.id}
          to={e.challenge_id ? `/challenges/${e.challenge_id}` : '/my-entries'}
          className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 transition hover:bg-slate-50 last:border-0"
        >
          <EntryThumb entry={e} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{e.title}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{e.challenge_title || 'Challenge'}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[(e.status || '').toLowerCase()] || STATUS_STYLES.pending}`}>
                {e.status || 'pending'}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                <Heart className="h-3.5 w-3.5" /> {e.vote_count ?? 0} vote{(e.vote_count ?? 0) === 1 ? '' : 's'}
              </span>
              {e.is_winner && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">Winner</span>}
              {e.is_finalist && !e.is_winner && <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">Finalist</span>}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
        </Link>
      ))}
    </div>
  );
}