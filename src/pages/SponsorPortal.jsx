import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, Trophy, Users, Heart } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { mySponsorProfile } from '@/lib/marketing';
import { challengeApi } from '@/lib/challengeApi';
import { getCombinedResults } from '@/lib/votes';

export default function SponsorPortal() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [comps, setComps] = useState([]);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      try {
        const r = await mySponsorProfile();
        setProfile(r?.profile || null);
        const ids = r?.profile?.competition_ids || [];
        const data = await Promise.all((ids).map(async (id) => {
          try {
            const [ch, entries] = await Promise.all([challengeApi.getChallenge(id), challengeApi.listEntries(id, { limit: 500 })]);
            const combined = await getCombinedResults(id);
            return { id, challenge: ch, entries: entries || [], results: combined.rows || [] };
          } catch (e) { return { id, error: true }; }
        }));
        setComps(data);
      } catch (e) {}
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading) return <div className="container-tight py-24 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>;
  if (!user) return <div className="container-tight py-24 text-center text-muted-foreground">Please log in to view the sponsor portal.</div>;
  if (!profile) return (
    <div className="container-tight py-24 text-center">
      <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
      <h1 className="mt-4 font-heading text-2xl font-bold">No sponsor access</h1>
      <p className="mt-2 text-muted-foreground">Your account isn't linked to a sponsor profile yet.</p>
      <Link to="/become-a-sponsor" className="mt-6 inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">Become a sponsor</Link>
    </div>
  );
  if (profile.status !== 'active') return (
    <div className="container-tight py-24 text-center">
      <Lock className="mx-auto h-10 w-10 text-gold" />
      <h1 className="mt-4 font-heading text-2xl font-bold">Application under review</h1>
      <p className="mt-2 text-muted-foreground">Your sponsor application for <b className="text-foreground">{profile.name}</b> is with our team. Your dashboard opens once it's approved.</p>
    </div>
  );

  return (
    <div className="container-tight py-12">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary"><Trophy className="h-6 w-6" /></div>
        <div>
          <h1 className="font-heading text-3xl font-extrabold">Sponsor Portal</h1>
          <p className="text-muted-foreground">{profile.name} · {profile.organisation}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Read-only view of your sponsored competitions — entries, participation and results.</p>
      {!comps.length && <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">No competitions assigned to your sponsor profile yet.</div>}
      <div className="mt-8 space-y-8">
        {comps.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border bg-card p-6">
            {c.error ? (
              <p className="text-sm text-muted-foreground">Competition {c.id} could not be loaded.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-xl font-bold">{c.challenge?.theme || c.challenge?.title || 'Competition'}</h2>
                    <p className="text-xs text-muted-foreground capitalize">{c.challenge?.category}</p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" /> {c.entries.length} entries</span>
                    <span className="inline-flex items-center gap-1.5"><Heart className="h-4 w-4 text-pink-400" /> {c.entries.reduce((a, e) => a + (e.community_votes || e.vote_count || 0), 0)} votes</span>
                  </div>
                </div>
                {c.results.length > 0 ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-border">
                    {c.results.slice(0, 5).map((r, i) => (
                      <div key={r.entry_id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm" style={i ? { borderTop: '1px solid hsl(var(--border))' } : undefined}>
                        <span className="truncate"><b className="text-primary">#{r.combined_rank}</b> · {r.entry_title || 'Entry'} — {r.creator_name || ''}</span>
                        <span className="text-muted-foreground">{r.combined_score.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-border">
                        {c.entries.slice(0, 50).map((e) => (
                          <tr key={e.id}><td className="px-4 py-2 font-medium">{e.title}</td><td className="px-4 py-2 text-muted-foreground">{e.creator_name}</td><td className="px-4 py-2 text-right">{e.community_votes || e.vote_count || 0} votes</td></tr>
                        ))}
                      </tbody>
                    </table>
                    {!c.entries.length && <p className="px-4 py-6 text-center text-muted-foreground">No entries yet.</p>}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}