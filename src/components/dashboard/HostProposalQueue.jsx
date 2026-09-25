/**
 * Admin review queue for host proposals — readable labels, full brief and the
 * contact details staff need to follow up.
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Check, MessageSquare, Ban } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ProposalDetailPanel from '@/components/dashboard/ProposalDetailPanel';
import { labelValue, labelList } from '@/lib/proposalLabels';
import ContentTypeBadge from '@/components/ContentTypeBadge';

// Statuses already decided upstream — no further approve/decline action allowed.
const DECIDED_STATUSES = ['approved', 'approved_and_signed', 'rejected', 'live'];

export default function HostProposalQueue() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null); // 'changes' | 'decline'
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await base44.functions.invoke('hostPortal', { action: 'admin_list' }).catch(() => null);
    setRows(res?.data?.proposals || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const apply = async (portalAction, extra, message) => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('hostPortal', {
        action: portalAction, id: selected.id, ...extra,
      });
      if (res.data?.error) {
        toast({ title: 'Action failed', description: res.data.error });
        return;
      }
      toast({ title: message, description: res.data?.challenge_id ? 'A draft challenge was created and is now in the compliance pipeline.' : undefined });
      setSelected(null);
      setAction(null);
      setNote('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3">Challenge</th>
              <th className="p-3">Content</th>
              <th className="p-3">Package</th>
              <th className="p-3">Participants</th>
              <th className="p-3">Added services</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No host proposals yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => { setSelected(r); setAction(null); setNote(''); }}
                className={`cursor-pointer border-b border-border/60 hover:bg-muted/40 ${selected?.id === r.id ? 'bg-muted/60' : ''}`}
              >
                <td className="p-3 font-medium">{r.challenge_title || 'Untitled challenge'}</td>
                <td className="p-3"><ContentTypeBadge value={r.content_type} /></td>
                <td className="p-3 text-muted-foreground">{labelValue(r.delivery_level)}</td>
                <td className="p-3 text-muted-foreground">{labelValue(r.participant_range)}</td>
                <td className="p-3 text-xs text-muted-foreground">{labelList(r.addons)}</td>
                <td className="p-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{labelValue(r.review_status)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <ProposalDetailPanel proposal={selected} onClose={() => setSelected(null)}>
          {action && (
            <textarea
              className="c53-input mt-5 min-h-[90px]"
              placeholder={action === 'changes' ? 'What changes does the host need to make?' : 'Why is this being declined?'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {DECIDED_STATUSES.includes(selected.review_status) ? (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                This request has already been {labelValue(selected.review_status).toLowerCase()} — no further action is needed.
              </p>
            ) : action === 'changes' ? (
              <Button size="sm" disabled={saving || !note.trim()} onClick={() => apply('request_changes', { feedback: note }, 'Changes requested')}>
                Send request
              </Button>
            ) : action === 'decline' ? (
              <Button size="sm" variant="destructive" disabled={saving || !note.trim()} onClick={() => apply('decline', { reason: note }, 'Proposal declined')}>
                Confirm decline
              </Button>
            ) : (
              <>
                <Button size="sm" disabled={saving} onClick={() => apply('approve', {}, 'Proposal approved')}>
                  <Check className="mr-1 h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAction('changes')}>
                  <MessageSquare className="mr-1 h-4 w-4" /> Request changes
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAction('decline')}>
                  <Ban className="mr-1 h-4 w-4" /> Decline
                </Button>
              </>
            )}
            {action && <Button size="sm" variant="ghost" onClick={() => { setAction(null); setNote(''); }}>Cancel</Button>}
          </div>
        </ProposalDetailPanel>
      )}
    </div>
  );
}