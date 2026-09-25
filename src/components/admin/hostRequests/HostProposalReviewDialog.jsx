import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import ProposalReviewCard from './ProposalReviewCard';
import GoLiveCard from './GoLiveCard';

const APPROVED_STATUSES = ['approved', 'approved_and_signed', 'live'];

const STATUS_CLS = {
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  approved_and_signed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  live: 'bg-blue-50 text-blue-700 border-blue-200',
  submitted_for_review: 'bg-amber-50 text-amber-700 border-amber-200',
  in_review: 'bg-amber-50 text-amber-700 border-amber-200',
  builder_started: 'bg-sky-50 text-sky-700 border-sky-200',
  intake_received: 'bg-slate-100 text-slate-600 border-slate-200',
  changes_requested: 'bg-orange-50 text-orange-700 border-orange-200',
  terms_pending: 'bg-purple-50 text-purple-700 border-purple-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

export default function HostProposalReviewDialog({ proposal, org, invoices = [], open, onOpenChange, onRefresh }) {
  if (!proposal) return null;

  const proposalInvoices = invoices.filter(
    (i) => i.proposal_id === proposal.id || i.draft_id === proposal.id
  );
  const status = proposal.review_status || proposal.status || 'submitted_for_review';
  const isApproved = APPROVED_STATUSES.includes(status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-slate-50 text-slate-900 border-slate-200 shadow-2xl">
        <DialogHeader className="border-b border-slate-200 pb-4">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="min-w-0">
              <DialogTitle className="text-xl font-bold text-slate-900">
                Challenge Application — {proposal.challenge_title || proposal.title || proposal.theme || 'Untitled'}
              </DialogTitle>
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                {org?.name || proposal.answers?.beneficiary_name || proposal.answers?.organisation_name || 'Unknown org'}
              </p>
            </div>
            <Badge variant="outline" className={`capitalize shrink-0 text-xs font-semibold px-3 py-1 ${STATUS_CLS[status] || STATUS_CLS.intake_received}`}>
              {status.replace(/_/g, ' ')}
            </Badge>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <ProposalReviewCard proposal={proposal} org={org} onRefresh={onRefresh} />
          {isApproved && (
            <GoLiveCard proposal={proposal} org={org} invoices={proposalInvoices} onRefresh={onRefresh} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}