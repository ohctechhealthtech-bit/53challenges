import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { summarise } from '@/lib/streak';
import StreakCard from '@/components/profile/StreakCard';
import GrowthStats from '@/components/profile/GrowthStats';
import CompletedChallengeList from '@/components/profile/CompletedChallengeList';

export default function MyProgress() {
  const { user, isAuthenticated, navigateToLogin } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) { navigateToLogin(); return; }
    (async () => {
      setLoading(true);
      try {
        // Never leave the page spinning forever if the request stalls.
        const res = await Promise.race([
          base44.functions.invoke('myEntries', { user_email: user?.email }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('This took too long to load. Please refresh to try again.')), 15000)),
        ]);
        setEntries(res.data?.entries || []);
      } catch (e) {
        setError(e?.message || 'Failed to load your progress.');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated]);

  const stats = useMemo(() => summarise(entries), [entries]);

  if (!isAuthenticated) return null;

  const initial = (user?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase();

  return (
    <div className="container-tight py-12">
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 border-card bg-muted text-xl font-extrabold text-primary">
          {initial}
        </div>
        <div>
          <h1 className="font-heading text-3xl font-extrabold">{user?.full_name || 'My progress'}</h1>
          <p className="mt-1 text-muted-foreground">Your challenges, streak and growth so far.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <span className="sr-only">Loading your progress</span>
        </div>
      ) : error ? (
        <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive" role="alert">{error}</div>
      ) : entries.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border py-20 text-center">
          <Sparkles className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <p className="mt-4 font-heading text-lg font-bold">Your journey starts with one entry</p>
          <p className="mt-1 text-sm text-muted-foreground">Complete your first challenge to begin building a streak.</p>
          <Link to="/challenges" className="mt-6 inline-flex items-center gap-1.5 rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white">
            Browse Challenges <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          <div className="grid gap-4 lg:grid-cols-3">
            <StreakCard current={stats.current} longest={stats.longest} activeWeeks={stats.activeWeeks} />
            <div className="lg:col-span-2">
              <GrowthStats
                completedCount={stats.completedCount}
                submittedCount={stats.submittedCount}
                challengeCount={stats.challengeCount}
                totalVotes={stats.totalVotes}
              />
            </div>
          </div>

          <section>
            <h2 className="font-heading text-xl font-bold">Challenges you've taken on</h2>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">
              {stats.completedCount} completed of {stats.submittedCount} submitted.
            </p>
            <CompletedChallengeList entries={entries} />
          </section>
        </div>
      )}
    </div>
  );
}