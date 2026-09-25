import { useState } from 'react';
import { Building2, Lightbulb, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import HostRequestDetailDialog from './HostRequestDetailDialog';

const STATUS_STYLES = {
  new: 'bg-red-100 text-red-700',
  in_review: 'bg-yellow-100 text-yellow-800',
  contacted: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-stone-200 text-stone-600',
};

const PROPOSAL_STATUS = {
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700' },
  in_review: { label: 'In review', cls: 'bg-yellow-100 text-yellow-800' },
  changes_requested: { label: 'Changes requested', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  live: { label: 'Live', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Declined', cls: 'bg-stone-200 text-stone-600' },
};

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return '';
  return d.toISOString().slice(0, 10);
}

export default function HostRequestsPanel({ requests = [], onChanged }) {
  const [selectedId, setSelectedId] = useState(null);

  const merged = [...requests].sort(
    (a, b) => new Date(b.submitted_at || b.created_date || 0) - new Date(a.submitted_at || a.created_date || 0)
  );

  return (
    <div id="host-requests" className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-5 h-5 text-orange-600" />
        <h2 className="text-lg font-bold text-stone-900">Host a Challenge Requests</h2>
        <Badge variant="outline" className="text-stone-900">{merged.length}</Badge>
      </div>

      {merged.length === 0 ? (
        <p className="text-sm text-stone-500 py-4 text-center">No host requests yet.</p>
      ) : (
        <div className="divide-y divide-stone-100">
          {merged.map((r) => {
            const isProposal = r.group === 'proposals' || r.kind === 'proposal';
            const datePart = [fmtDate(r.start_date), fmtDate(r.end_date)].filter(Boolean).join(' → ');
            const proposalLine = [
              r.company_name,
              r.service_package ? `Package: ${r.service_package}` : '',
              datePart,
              r.state,
            ].filter(Boolean).join(' · ');
            const enquiryLine = `${r.company_name || ''} · ${r.contact_name || ''} · ${r.contact_email || ''}`.replace(/^ · | · $/g, '');
            const ps = isProposal && r.proposal_status ? PROPOSAL_STATUS[r.proposal_status] : null;
            const statusLabel = ps ? ps.label : (r.status || 'new').replace(/_/g, ' ');
            const statusCls = ps ? ps.cls : (STATUS_STYLES[r.status] || '');
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`w-full text-left flex items-center justify-between gap-4 py-3 px-2 rounded hover:bg-stone-50 ${!r.is_read ? 'bg-orange-50/60' : ''}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${isProposal ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                      {isProposal ? <><Trophy className="w-3 h-3 mr-1" />Application</> : <><Lightbulb className="w-3 h-3 mr-1" />Enquiry</>}
                    </span>
                    {r.not_synced && (
                      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                        Not sent to main app
                      </span>
                    )}
                    {!r.is_read && <span className="inline-block w-2 h-2 bg-red-500 rounded-full" />}
                  </div>
                  <p className="font-semibold text-stone-900 truncate mt-0.5">
                    {r.working_title || r.challenge_title || 'Untitled'}
                  </p>
                  <p className="text-sm text-stone-600 truncate">
                    {isProposal ? proposalLine : enquiryLine}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-stone-400">
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-AU') : ''}
                  </span>
                  <Badge className={`text-xs ${statusCls}`}>
                    {statusLabel}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <HostRequestDetailDialog
        open={!!selectedId}
        onOpenChange={(o) => { if (!o) setSelectedId(null); }}
        requestId={selectedId}
        row={merged.find((r) => r.id === selectedId)}
        onChanged={onChanged}
      />
    </div>
  );
}