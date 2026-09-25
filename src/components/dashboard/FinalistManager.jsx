import { useState, useEffect, useCallback } from 'react';
import { Crown, Star, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { challengeApi } from '@/lib/challengeApi';
import { categoryMeta } from '@/lib/challenges-data';

const MAX_FINALISTS = 5;

export default function FinalistManager() {
  const [entries, setEntries] = useState([]);
  const [finalists, setFinalists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [warn, setWarn] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [latestRes, existingFinalists] = await Promise.all([
        challengeApi.latestEntries(100),
        base44.entities.Entry.filter({ is_finalist: true }, '-finalist_week', 100),
      ]);
      setEntries(latestRes?.entries || []);
      setFinalists(existingFinalists || []);
    } catch (e) {
      setError('Failed to load entries: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const finalistEntryIds = new Set(finalists.map((f) => f.upstream_entry_id).filter(Boolean));
  const finalistCount = finalists.length;
  const atLimit = finalistCount >= MAX_FINALISTS;

  const handleMark = async (entry) => {
    if (atLimit) {
      setWarn(`Maximum ${MAX_FINALISTS} finalists reached. Remove one before adding another.`);
      return;
    }
    setBusy(entry.id);
    setWarn('');
    try {
      const record = await base44.entities.Entry.create({
        challenge_id: entry.challenge_id || '',
        title: entry.title || 'Untitled',
        creator_name: entry.creator_name || 'Unknown',
        state: entry.state || '',
        division: entry.division || 'adults',
        status: 'approved',
        is_finalist: true,
        finalist_week: new Date().toISOString(),
        upstream_entry_id: entry.id,
        category: entry.category || entry.challenge_category || '',
        challenge_title: entry.challenge_title || '',
        work_link: entry.work_url || entry.work_link || '',
        vote_count: entry.community_votes ?? entry.vote_count ?? 0,
        submitted_at: entry.submitted_at || new Date().toISOString(),
      });
      setFinalists((prev) => [...prev, record]);
    } catch (e) {
      setError('Failed to mark finalist: ' + e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (finalist) => {
    setBusy(finalist.id);
    setWarn('');
    try {
      await base44.entities.Entry.delete(finalist.id);
      setFinalists((prev) => prev.filter((f) => f.id !== finalist.id));
    } catch (e) {
      setError('Failed to remove finalist: ' + e.message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}
      {warn && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {warn}
        </div>
      )}

      {/* Current Finalists */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold">Current Finalists ({finalistCount}/{MAX_FINALISTS})</h3>
        </div>
        {finalists.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No finalists marked yet. Mark approved entries below to feature them on the homepage.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {finalists.map((f, i) => {
              const cat = categoryMeta((f.category || '').replace(/_/g, '-'));
              return (
                <div key={f.id} className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-bold text-white">{i + 1}</span>
                      <Crown className="h-4 w-4 text-primary" />
                    </div>
                    <button
                      onClick={() => handleRemove(f)}
                      disabled={busy === f.id}
                      className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      title="Remove finalist"
                    >
                      {busy === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-2 line-clamp-1 font-semibold">{f.title}</p>
                  <p className="text-xs text-muted-foreground">by {f.creator_name}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{cat.name}</span>
                    {f.state && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{f.state}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Approved Entries — mark as finalist */}
      <div>
        <h3 className="font-heading text-lg font-bold">Approved Entries</h3>
        <p className="mt-1 text-sm text-muted-foreground">Click the star to feature an entry as a finalist on the homepage.</p>
        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No approved entries available.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((e) => {
              const isMarked = finalistEntryIds.has(e.id);
              const cat = categoryMeta((e.category || e.challenge_category || '').replace(/_/g, '-'));
              return (
                <div key={e.id} className={`rounded-xl border p-4 transition ${isMarked ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="line-clamp-1 font-semibold">{e.title}</p>
                      <p className="text-xs text-muted-foreground">by {e.creator_name}</p>
                    </div>
                    {isMarked ? (
                      <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs font-bold text-white">
                        <Crown className="h-3 w-3" /> Finalist
                      </span>
                    ) : (
                      <button
                        onClick={() => handleMark(e)}
                        disabled={busy === e.id || atLimit}
                        className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                        title={atLimit ? `Max ${MAX_FINALISTS} finalists reached` : 'Mark as finalist'}
                      >
                        {busy === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
                        Mark
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{cat.name}</span>
                    {e.state && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{e.state}</span>}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{e.community_votes ?? e.vote_count ?? 0} votes</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}