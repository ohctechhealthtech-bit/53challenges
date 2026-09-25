import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

export default function MyVotes() {
  const { user, isAuthenticated, navigateToLogin } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) { navigateToLogin(); return; }
    (async () => {
      setLoading(true);
      try {
        const res = await base44.functions.invoke('myVotes', { user_email: user?.email });
        setEntries(res.data?.entries || []);
      } catch (e) {
        setError(e?.message || 'Failed to load votes.');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <div className="container-tight py-12">
      <h1 className="font-heading text-3xl font-extrabold">My Votes</h1>
      <p className="mt-2 text-muted-foreground">Entries you've voted for across all challenges.</p>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">{error}</div>
      ) : entries.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border py-20 text-center">
          <Heart className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 font-heading text-lg font-bold">No votes yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Vote on entries to see them here.</p>
          <Link to="/challenges" className="mt-6 inline-flex items-center gap-1.5 rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white">
            Browse Challenges <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {entries.map((e) => (
            <div key={e.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-heading text-lg font-bold">{e.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">by {e.creator_name} · {e.challenge_title}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      <Heart className="h-3 w-3 fill-current" /> Voted
                    </span>
                    {(e.community_votes ?? e.vote_count) > 0 && (
                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                        {e.community_votes ?? e.vote_count} total votes
                      </span>
                    )}
                  </div>
                </div>
                {e.challenge_id && (
                  <Link to={`/challenges/${e.challenge_id}`} className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium transition hover:border-primary hover:text-primary">
                    View
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}