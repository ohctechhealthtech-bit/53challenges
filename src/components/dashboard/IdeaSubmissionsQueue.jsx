/** Admin review queue for ideas sent via the public "Tell us your idea" wizard. */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Lightbulb } from 'lucide-react';
import { hostPortal } from '@/lib/hostPortalClient';
import IdeaSubmissionDetail from '@/components/dashboard/IdeaSubmissionDetail';
import IdeaStatusFilter from '@/components/dashboard/IdeaStatusFilter';
import { ideaLabel, ideaStatusLabel } from '@/components/dashboard/ideaLabels';

export default function IdeaSubmissionsQueue() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hostPortal('list_idea_submissions', {});
      setIdeas(res?.ideas || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!ideas.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <Lightbulb className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">No challenge ideas have been submitted yet.</p>
      </div>
    );
  }

  const current = ideas.find((i) => i.id === selected?.id) || selected;

  const counts = ideas.reduce((acc, i) => {
    const key = i.review_status || 'new';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const visible =
    statusFilter === 'all'
      ? ideas
      : ideas.filter((i) => (i.review_status || 'new') === statusFilter);

  return (
    <div className="space-y-5">
      <IdeaStatusFilter
        value={statusFilter}
        onChange={setStatusFilter}
        counts={counts}
        total={ideas.length}
      />

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Submitted by</th>
              <th className="px-4 py-3">Idea</th>
              <th className="px-4 py-3">Activity</th>
              <th className="px-4 py-3">People</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((idea) => (
              <tr
                key={idea.id}
                onClick={() => setSelected(idea)}
                className={`cursor-pointer border-t border-border transition-colors hover:bg-muted/40 ${selected?.id === idea.id ? 'bg-muted/40' : ''}`}
              >
                <td className="px-4 py-3">
                  <span className="font-semibold">{idea.answers?.name || '—'}</span>
                  <span className="block text-xs text-muted-foreground">{idea.answers?.email}</span>
                </td>
                <td className="px-4 py-3">{idea.challenge_title || 'Untitled'}</td>
                <td className="px-4 py-3">{ideaLabel('activity_type', idea.answers?.activity_type)}</td>
                <td className="px-4 py-3">{ideaLabel('participants', idea.answers?.participants)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(idea.created_date).toLocaleDateString('en-AU')}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold">
                    {ideaStatusLabel(idea.review_status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length ? (
          <p className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No submissions with this status.
          </p>
        ) : null}
      </div>

      {current ? (
        <IdeaSubmissionDetail idea={current} onClose={() => setSelected(null)} onUpdated={load} />
      ) : null}
    </div>
  );
}