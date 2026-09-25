import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ArrowRight, Vote, Trophy } from 'lucide-react';
import { challengeApi } from '@/lib/challengeApi';

const RED = '#f15249';
const TEAL = '#0a8882';

/** Discover sub-tab: challenges currently open for entry or in voting. */
export default function DiscoverChallenges() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await challengeApi.listChallenges().catch(() => ({ challenges: [] }));
        const now = new Date();
        const open = (res.challenges || []).filter((c) => {
          if (c.compliance_blocked) return false;
          if (c.lifecycle_status === 'entry_open' || c.lifecycle_status === 'voting_open') return true;
          const subEnd = c.submission_ends_at ? new Date(c.submission_ends_at) : null;
          const voteEnd = c.voting_ends_at ? new Date(c.voting_ends_at) : null;
          return (subEnd && subEnd >= now) || (voteEnd && voteEnd >= now);
        });
        setList(open.slice(0, 12));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        No challenges are open for entry or voting right now.
        <div className="mt-3">
          <Link to="/challenges" className="font-bold" style={{ color: RED }}>Browse all challenges</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((c) => {
        const voting = c.lifecycle_status === 'voting_open';
        return (
          <div key={c.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span
              className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
              style={{ backgroundColor: voting ? TEAL : RED }}
            >
              {voting ? <Vote className="h-3 w-3" /> : <Trophy className="h-3 w-3" />}
              {voting ? 'Voting open' : 'Entry open'}
            </span>
            <h3 className="mt-3 line-clamp-2 font-bold text-slate-900">{c.title}</h3>
            {c.brief && <p className="mt-1 line-clamp-3 text-sm text-slate-500">{c.brief}</p>}
            <Link
              to={`/challenges/${c.id}`}
              className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: voting ? TEAL : RED }}
            >
              {voting ? 'Vote now' : 'View challenge'} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        );
      })}
    </div>
  );
}