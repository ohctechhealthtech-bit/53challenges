import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Check, X, MessageSquareWarning, Loader2, ChevronRight, Calendar, DollarSign, MapPin, Mail, Package } from 'lucide-react';
import { hostPortal } from '@/lib/hostPortalClient';
import { toast } from 'sonner';
import ProposalDetailsPanel from './ProposalDetailsPanel';

const RISK_CLS = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-red-50 text-red-700 border-red-200',
};

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

const ACTIONABLE = ['submitted_for_review', 'in_review', 'intake_received', 'builder_started'];

export default function ProposalReviewCard({ proposal: raw, org, onRefresh }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  if (!raw) return null;

  // Flatten the ChallengeDraft into the shape this card reads.
  const a = raw.answers || {};
  const routing = a.routing || {};
  const price = a.main_app_price || {};
  const p = {
    ...raw,
    title: raw.challenge_title || raw.title || raw.theme || '',
    description: raw.challenge_description || a.challenge_description || raw.brief || '',
    status: raw.review_status || raw.status || 'submitted_for_review',
    risk_level: routing.risk_level || raw.risk_level || 'low',
    risk_factors: [...(raw.compliance_flags || []), ...(routing.risk_factors || [])],
    start_date: a.start_date || raw.starts_at || '',
    end_date: a.end_date || raw.submission_ends_at || '',
    state: a.state || raw.state || '',
    entry_fee: a.entry_fee || 0,
    prize_budget: a.prize_budget || 0,
    total_price: price.total_price || 0,
    host_type: raw.host_type || a.host_type || '',
    content_type: raw.content_type || a.content_type || 'admin_managed',
    beneficiary_for: a.beneficiary_for || '',
    beneficiary_name: a.beneficiary_name || a.organisation_name || a.org_name || '',
    beneficiary_notes: a.beneficiary_notes || '',
    beneficiary_contact_name: a.beneficiary_contact_name || a.contact_name || '',
    beneficiary_contact_role: a.beneficiary_contact_role || '',
    beneficiary_contact_email: a.beneficiary_contact_email || a.contact_email || a.host_email || '',
    beneficiary_phone: a.beneficiary_phone || a.contact_phone || '',
    beneficiary_website: a.beneficiary_website || '',
    category: raw.category || a.category || '',
    accepted_entry_types: a.accepted_entry_types || a.work_type || '',
    age_divisions: raw.divisions || a.age_divisions || a.divisions || [],
    season: a.season || raw.season || '',
    voting_end_date: a.voting_end_date || raw.voting_ends_at || '',
    expected_entries: a.expected_entries || '',
    service_package: raw.service_tier || a.service_package || a.delivery_level || '',
    program_scope: raw.program_scope || a.program_scope || 'single',
    series_count: a.series_count || '',
    series_cadence: a.series_cadence || '',
    template_key: a.template_id || a.template_key || '',
    addon_keys: raw.addons || a.addons || a.addon_keys || [],
    base_price: price.base_price || price.package_price || 0,
    addons_price: price.addons_price || 0,
    amount_paid: a.amount_paid || 0,
    payment_status: a.payment_status || '',
    application_invoice_id: a.application_invoice_id || a.main_app_invoice_id || '',
    cover_image: a.cover_image || raw.cover_image || '',
    quotation_text: a.quotation_text || '',
    decision_reason: raw.admin_feedback || raw.decline_reason || '',
  };

  const decide = async (decision) => {
    setBusy(decision);
    const action = decision === 'approve' ? 'approve' : decision === 'changes' ? 'request_changes' : 'decline';
    const payload = { id: raw.id };
    if (decision === 'changes') payload.feedback = reason;
    if (decision === 'reject') payload.reason = reason;
    try {
      await hostPortal(action, payload);
      toast.success(decision === 'approve' ? 'Application approved' : decision === 'changes' ? 'Changes requested' : 'Application declined');
      onRefresh?.();
    } catch (e) {
      toast.error(e?.message || 'Failed to update');
    } finally {
      setBusy('');
    }
  };

  const open = ACTIONABLE.includes(p.status);
  const pkgLabel = (p.service_package || '').replace(/_/g, ' ');

  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardContent className="pt-5 pb-5 space-y-4">
        {/* Row 1 — key metadata */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-slate-900 text-base">{p.title || 'Untitled'}</p>
              <Badge className={`text-xs capitalize border ${RISK_CLS[p.risk_level] || RISK_CLS.low}`}>Risk: {p.risk_level}</Badge>
              <Badge variant="outline" className={`text-xs capitalize border ${STATUS_CLS[p.status] || STATUS_CLS.intake_received}`}>{p.status.replace(/_/g, ' ')}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                {org?.name || p.beneficiary_name || 'Unknown org'}
              </span>
              {p.beneficiary_contact_email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-400" />
                  {p.beneficiary_contact_email}
                </span>
              )}
              {pkgLabel && (
                <span className="flex items-center gap-1">
                  <Package className="w-3 h-3 text-slate-400" />
                  {pkgLabel}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              {(p.start_date || p.end_date) && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {p.start_date ? p.start_date.slice(0, 10) : ''}
                  {p.end_date ? ` → ${p.end_date.slice(0, 10)}` : ''}
                </span>
              )}
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                {p.state || 'All states'}
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-slate-400" />
                Fee ${p.entry_fee || 0} · Prize ${p.prize_budget || 0} · Quote ${p.total_price || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2 — description + compliance warnings */}
        {p.description && (
          <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
            <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{p.description}</p>
          </div>
        )}
        {(p.risk_factors || []).length > 0 && (
          <div className="space-y-1.5">
            {(p.risk_factors || []).map((f) => (
              <p key={f} className="text-xs text-red-600 flex items-start gap-1.5 bg-red-50 border border-red-100 rounded-md px-3 py-1.5">
                <span className="text-red-500 mt-0.5 shrink-0">•</span>
                <span>{f}</span>
              </p>
            ))}
          </div>
        )}

        {/* Row 3 — expandable details */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-50/50 transition-colors"
          >
            <ChevronRight className={`w-4 h-4 transition-transform text-blue-500 ${showDetails ? 'rotate-90' : ''}`} />
            Full application details — everything the host entered
          </button>
          {showDetails && (
            <div className="border-t border-slate-200 p-4 bg-slate-50/50">
              <ProposalDetailsPanel proposal={p} org={org} />
            </div>
          )}
        </div>

        {/* Action footer */}
        {open && (
          <div className="space-y-3 pt-1 border-t border-slate-100">
            <Textarea
              rows={2}
              placeholder="Decision reason / feedback for the host…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-white border-slate-200 focus-visible:ring-blue-500/30"
            />
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => decide('approve')} disabled={!!busy} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                {busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => decide('changes')} disabled={!!busy} className="border-amber-300 text-amber-700 hover:bg-amber-50">
                {busy === 'changes' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquareWarning className="w-4 h-4" />} Request changes
              </Button>
              <Button size="sm" variant="destructive" onClick={() => decide('reject')} disabled={!!busy} className="shadow-sm">
                {busy === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Reject
              </Button>
            </div>
          </div>
        )}
        {p.decision_reason && !open && (
          <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-2.5">
            <p className="text-xs text-slate-500"><span className="font-semibold text-slate-600">Decision:</span> {p.decision_reason}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}