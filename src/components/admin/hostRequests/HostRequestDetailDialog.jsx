import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { adminChallengeApi, adminChallengeData } from '@/lib/adminChallengeApi';
import { hostPortal } from '@/lib/hostPortalClient';
import { base44 } from '@/api/base44Client';
import HostRequestChat from './HostRequestChat';
import HostRequestQuotePanel from './HostRequestQuotePanel';
import IdeaAnswersTable from './IdeaAnswersTable';
import HostRequestAiAnalysis from './HostRequestAiAnalysis';
import HostRequestConvertDialog from './HostRequestConvertDialog';
import { humanize, humanizeNotes } from './humanizeRequest';
import { mapLocalDraftToDetail } from './mapLocalDraft';
import ExactPaymentPanel from './ExactPaymentPanel';

const STATUSES = ['new', 'in_review', 'contacted', 'accepted', 'declined'];

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm text-foreground whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export default function HostRequestDetailDialog({ open, onOpenChange, requestId, row, onChanged, onConvert }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [convert, setConvert] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminChallengeApi.getHostRequest({ id: requestId });
      setData(data);
    } catch (e) {
      // Fallback: the ID might be a local ChallengeDraft (from /host-apply),
      // which isn't in the parent's HostChallengeRequest table.
      try {
        const drafts = await base44.entities.ChallengeDraft.filter({ id: requestId }, '-created_date', 1);
        const draft = drafts?.[0];
        if (draft) {
          setData(mapLocalDraftToDetail(draft));
        } else {
          setError(e.message);
        }
      } catch {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !requestId) {
      setData(null);
      setError('');
      setLoading(false);
      return;
    }
    load();
  }, [open, requestId]);

  const isLocal = !!data?._local;

  // Mark read on open (parent requests only — local drafts are already marked).
  useEffect(() => {
    if (!open || !requestId) return;
    if (isLocal) return;
    adminChallengeData('hostRequests.update', { id: requestId, markRead: true })
      .then(() => onChanged?.())
      .catch(() => {});
  }, [open, requestId]);

  const request = data?.request;
  const answers = data?.idea_answers || [];
  const messages = data?.messages || [];

  const changeStatus = async (status) => {
    try {
      if (isLocal) {
        // Local ChallengeDraft — update the local record's review_status.
        const PARENT_TO_REVIEW = {
          new: 'intake_received',
          in_review: 'in_review',
          contacted: 'terms_pending',
          accepted: 'approved',
          declined: 'rejected',
        };
        await base44.entities.ChallengeDraft.update(requestId, { review_status: PARENT_TO_REVIEW[status] || 'intake_received' });
      } else {
        await adminChallengeApi.updateHostRequest({ id: requestId, status });
        if (status === 'accepted' && request?.contact_email) {
          await hostPortal('admin_grant_host_role', { email: request.contact_email }).catch(() => {});
        }
      }
      toast.success(`Status set to ${status.replace(/_/g, ' ')}`);
      load();
      onChanged?.();
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8">{request?.working_title || 'Host request'}</DialogTitle>
          {(request?.kind === 'proposal' || row?.kind === 'proposal' || row?.group === 'proposals') && (
            <p className="text-sm text-muted-foreground -mt-2">
              Host application from /host-apply · Package: {request?.service_package || row?.service_package || '—'} · Payment: {request?.payment_status || row?.payment_status || '—'}
            </p>
          )}
        </DialogHeader>
        {/* The exact amount charged, from our Stripe record. The request's own
            budget and notes come from the parent and have disagreed with it. */}
        <ExactPaymentPanel
          email={request?.contact_email || row?.contact_email || ''}
          requestId={request?.id || row?.id || ''}
        />

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading request…</p>
        ) : error ? (
          <p className="py-6 text-sm text-destructive">{error}</p>
        ) : request ? (
          <div className="space-y-5">
            {/* Status badges + convert */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Status:</span>
                {STATUSES.map((s) => (
                  <Badge
                    key={s}
                    onClick={() => changeStatus(s)}
                    className={`cursor-pointer capitalize text-xs ${request.status === s ? 'bg-orange-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                  >
                    {s.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
              <Button size="sm" onClick={() => setConvert(true)} className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
                <Sparkles className="w-4 h-4" /> Convert to Challenge
              </Button>
            </div>

            {/* Contact details */}
            <div className="grid md:grid-cols-2 gap-4 border border-border rounded-lg p-4 bg-muted/40">
              <Field label="Company / Organisation" value={request.company_name} />
              <Field label="Website" value={request.website} />
              <Field label="Industry" value={humanize(request.industry)} />
              <Field label="Contact name" value={request.contact_name} />
              <Field label="Contact email" value={request.contact_email} />
              <Field label="Phone" value={request.phone} />
            </div>

            {/* Challenge details */}
            <div className="grid md:grid-cols-2 gap-4 border border-border rounded-lg p-4 bg-muted/40">
              <Field label="Type of challenge" value={humanize(request.challenge_type)} />
              <Field label="Main goal" value={request.main_goal} />
              <div className="md:col-span-2"><Field label="Description" value={request.description} /></div>
              <Field label="Who should participate" value={humanize(request.participants)} />
              <Field label="Expected participants" value={humanize(request.expected_participants)} />
              <Field label="Geographic scope" value={humanize(request.geographic_scope)} />
              <Field label="Launch timeframe" value={humanize(request.launch_timeframe)} />
              <Field label="Estimated budget" value={request.budget_range} />
              <Field label="Prize format" value={request.prize_format} />
              <div className="md:col-span-2"><Field label="Additional notes" value={humanizeNotes(request.additional_notes)} /></div>
              <Field label="Heard about us via" value={request.heard_about} />
              <Field label="Submitted" value={request.submitted_at ? new Date(request.submitted_at).toLocaleString('en-AU') : ''} />
            </div>

            <HostRequestAiAnalysis request={request} />
            <HostRequestQuotePanel request={request} onChanged={onChanged} />
            <IdeaAnswersTable answers={answers} />
            <HostRequestChat request={request} messages={messages} onChanged={onChanged} />
          </div>
        ) : null}

        {convert && (
          <HostRequestConvertDialog
            open={convert}
            onOpenChange={setConvert}
            requestId={requestId}
            onConverted={() => { load(); onChanged?.(); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}