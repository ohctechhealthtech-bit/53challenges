import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Loader2, ArrowRight, Pencil, Lock } from 'lucide-react';
import EntryEditDialog from '@/components/entries/EntryEditDialog';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/appSession';
import PromoCallout from '@/components/promo/PromoCallout';
import ShareButtons from '@/components/promo/ShareButtons';

const STATUS_STYLES = {
  approved: 'bg-green-500/10 text-green-400',
  pending: 'bg-yellow-500/10 text-yellow-400',
  rejected: 'bg-red-500/10 text-red-400',
};

const STATUS_LABELS = {
  approved: 'Approved',
  pending: 'Pending review',
  rejected: 'Rejected — needs changes',
};

export default function MyEntries() {
  const { user, isAuthenticated, navigateToLogin } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) { navigateToLogin(); return; }
    (async () => {
      setLoading(true);
      try {
        const res = await base44.functions.invoke('myEntries', { session_token: getSessionToken() });
        setEntries(res.data?.entries || []);
      } catch (e) {
        setError(e?.message || 'Failed to load entries.');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <div className="container-tight py-12">
      <h1 className="font-heading text-3xl font-extrabold">My Entries</h1>
      <p className="mt-2 text-muted-foreground">Entries you've submitted across all challenges.</p>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">{error}</div>
      ) : entries.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border py-20 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 font-heading text-lg font-bold">No entries yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Submit your work to a challenge to see it here.</p>
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
                  <p className="mt-1 text-sm text-muted-foreground">{e.challenge_title}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[e.status] || STATUS_STYLES.pending}`}>
                      {STATUS_LABELS[e.status] || STATUS_LABELS.pending}
                    </span>
                    {(e.community_votes ?? e.vote_count) > 0 && (
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {e.community_votes ?? e.vote_count} votes
                      </span>
                    )}
                  </div>
                  {e.main_site && !e.editable && (
                    <p className="mt-3 flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{e.locked_reason || 'This entry has been reviewed — it can no longer be edited.'}</span>
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {e.editable && (
                    <button
                      onClick={() => setEditing(e)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/10"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                  )}
                  {e.challenge_id && (
                    <Link to={`/challenges/${e.challenge_id}`} className="rounded-lg border border-border px-3 py-2 text-xs font-medium transition hover:border-primary hover:text-primary">
                      View
                    </Link>
                  )}
                  <PromoCallout compact to={`/my-promo?entry=${e.id}`} />
                </div>
              </div>

              {e.status === 'rejected' && e.review_note && (
                <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <p className="font-semibold">Why this was rejected</p>
                  <p className="mt-1">{e.review_note}</p>
                  <p className="mt-1 text-xs opacity-80">Make your changes and save — it goes back for review.</p>
                </div>
              )}

              {e.locked_reason && !e.main_site && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> {e.locked_reason}
                </p>
              )}

              {e.status === 'approved' && e.challenge_id && (
                <div className="mt-4 border-t border-border pt-4">
                  <ShareButtons
                    url={`${window.location.origin}/challenges/${e.challenge_id}`}
                    text={`I entered "${e.title}" in ${e.challenge_title || 'a 53 Challenges challenge'} — take a look and vote for it!`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EntryEditDialog
          key={editing.id}
          entry={editing}
          open
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setEntries((list) => list.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}