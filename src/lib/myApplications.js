/** Plain-language labels for the unified "My requests" list. */
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/appSession';

export const KIND_LABELS = {
  request: 'Challenge request',
  application: 'Host application',
  idea: 'Challenge idea',
  judge: 'Judge application',
};

const STATUS_LABELS = {
  // enquiry / idea statuses
  new: 'Submitted',
  planning: 'Being planned',
  contacted: 'In conversation',
  'in-progress': 'In review',
  in_review: 'In review',
  accepted: 'Accepted',
  declined: 'Not proceeding',
  completed: 'Completed',
  rejected: 'Not proceeding',
  // host application statuses
  intake_received: 'Submitted',
  builder_started: 'Being prepared',
  submitted_for_review: 'In review',
  changes_requested: 'Changes needed',
  terms_pending: 'Awaiting your sign-off',
  approved: 'Approved',
  approved_and_signed: 'Approved',
  live: 'Live',
  // judge statuses
  applicant: 'In review',
  active: 'Approved',
  retired: 'Closed',
};

const DONE = ['approved', 'approved_and_signed', 'live', 'accepted', 'active', 'completed'];
const CLOSED = ['rejected', 'declined', 'retired'];

export function statusLabel(status) {
  return STATUS_LABELS[String(status || 'new')] || 'Submitted';
}

export function statusTone(status) {
  const s = String(status || '');
  if (DONE.includes(s)) return 'bg-emerald-500/15 text-emerald-400';
  if (CLOSED.includes(s)) return 'bg-destructive/15 text-destructive';
  if (s === 'changes_requested' || s === 'terms_pending') return 'bg-yellow-500/15 text-yellow-400';
  return 'bg-primary/15 text-primary';
}

export async function loadMyApplications() {
  const res = await base44.functions.invoke('myApplications', { session_token: getSessionToken() });
  if (res.data?.error) throw new Error(res.data.error);
  return res.data?.items || [];
}