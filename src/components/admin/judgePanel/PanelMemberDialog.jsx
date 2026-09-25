import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import { formatDateTime, prettyList } from './panelMeta';

export default function PanelMemberDialog({ open, onOpenChange, challengeId, member }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    adminChallengeApi
      .judgePanelMember({ challengeId, assignmentId: member.id, judgeEmail: member.judge_email })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [challengeId, member]);

  const j = data?.judge;
  const s = data?.scoring;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{member.display_name || member.judge_email}</DialogTitle>
          <DialogDescription>{member.judge_email} · invited {formatDateTime(member.assigned_at)}</DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Loading this judge…</p>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Roster record</div>
                <div className="mt-1 font-semibold">{data.on_master_roster ? 'On the master roster' : 'Not on the roster'}</div>
                {j && <div className="text-muted-foreground">{j.level} level · {prettyList(j.disciplines)}</div>}
                {j && <div className="text-muted-foreground">{j.active ? 'Active' : 'Inactive'} · added {formatDateTime(j.created_date)}</div>}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Scoring progress</div>
                <div className="mt-1 font-semibold">{s?.scored_entries ?? 0}/{s?.eligible_entries ?? 0} scored · {s?.progress_percent ?? 0}%</div>
                <div className="text-muted-foreground">
                  {s?.outstanding_entries ?? 0} to go · average {s?.average_total == null ? '—' : Number(s.average_total).toFixed(1)}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Conflict check</div>
              <div className={`mt-1 font-semibold ${s?.attestation_complete ? 'text-success' : 'text-gold'}`}>
                {s?.attestation_complete ? 'Confirmed' : 'Awaiting confirmation'}
              </div>
              {(s?.attestations || []).map((a) => (
                <div key={a.id} className="text-muted-foreground">
                  {String(a.category || '').replace(/[_-]/g, ' ')} · {a.has_conflict ? 'conflict declared' : 'no conflict'} · {formatDateTime(a.attested_at)}
                </div>
              ))}
              {(s?.recused_entry_ids || []).length > 0 && (
                <div className="mt-1 text-muted-foreground">Stepped back from {s.recused_entry_ids.length} submissions</div>
              )}
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Portfolio works</div>
              <div className="mt-1 text-muted-foreground">
                {(data.works || []).length === 0
                  ? 'No portfolio works on file.'
                  : data.works.map((w) => w.title || w.name).filter(Boolean).join(', ')}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}