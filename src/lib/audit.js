// Frontend helpers for the audit + prize workflow.
import { base44 } from '@/api/base44Client';

export async function listCompetitions() {
  return base44.functions.invoke('challengeApi', { action: 'challenges' })
    .then((r) => r.data?.challenges || [])
    .catch(() => []);
}

export function getAuditReview(competitionId) {
  return base44.entities.AuditReview.filter({ competition_id: competitionId }, '-created_date', 5)
    .then((xs) => (xs || [])[0] || null).catch(() => null);
}

export function getFindings(reviewId) {
  return base44.entities.AuditFinding.filter({ review_id: reviewId }, '-created_date', 200).catch(() => []);
}

export function getPrizeLedger(competitionId) {
  return base44.entities.PrizeLedger.filter({ competition_id: competitionId }, '-created_date', 5)
    .then((xs) => (xs || [])[0] || null).catch(() => null);
}

export function getPayouts(competitionId) {
  return base44.entities.PrizePayout.filter({ competition_id: competitionId }, '-created_date', 200).catch(() => []);
}

export function getPanel(competitionId) {
  return base44.entities.JudgingPanel.filter({ competition_id: competitionId }, '-created_date', 5)
    .then((xs) => (xs || [])[0] || null).catch(() => null);
}

export async function getJudges(competitionId) {
  const ids = new Set();
  const a = await base44.entities.CompetitionAssignment.filter({ competition_id: competitionId, status: 'active' }, '-assigned_at', 200).catch(() => []);
  (a || []).forEach((x) => { if (x.role === 'judge' || x.role === 'manager') x.judge_profile_id && ids.add(x.judge_profile_id); });
  if (!ids.size) return [];
  const profiles = await base44.entities.JudgeProfile.list('-name', 500).catch(() => []);
  return (profiles || []).filter((p) => ids.has(p.id));
}

export function auditAction(competitionId, action, payload = {}) {
  return base44.functions.invoke('auditCompetition', { competition_id: competitionId, action, ...payload }).then((r) => r.data);
}

export function saveLedger(competitionId, data, ledgerId) {
  return base44.functions.invoke('prizeLedger', { action: 'save', competition_id: competitionId, ledger_id: ledgerId || undefined, data }).then((r) => r.data);
}

export function generatePayouts(competitionId) {
  return base44.functions.invoke('prizeLedger', { action: 'generate_payouts', competition_id: competitionId }).then((r) => r.data);
}

export function payoutAction(payoutId, action, data = {}) {
  return base44.functions.invoke('prizePayoutAction', { payout_id: payoutId, action, data }).then((r) => r.data);
}

export const REVIEW_STATUS = {
  not_started: { label: 'Not started', tone: 'text-muted-foreground' },
  pre_launch: { label: 'Pre-launch passed', tone: 'text-blue-400' },
  pending_audit: { label: 'Pending audit', tone: 'text-amber-400' },
  in_audit: { label: 'In audit', tone: 'text-purple-400' },
  signed_off: { label: 'Independently audited', tone: 'text-emerald-400' },
  routed: { label: 'Routed for resolution', tone: 'text-orange-400' },
};

export const CHECKLIST_ITEMS = [
  { key: 'scores_recomputed', label: 'Scores recomputed from raw data and match stored results' },
  { key: 'blind_judging_confirmed', label: 'Blind judging confirmed (anonymous ids present)' },
  { key: 'conflict_exclusions_confirmed', label: 'Conflict-of-interest exclusions applied' },
  { key: 'winning_evidence_verified', label: 'Winning evidence re-verified' },
  { key: 'eligibility_confirmed', label: 'Entrant eligibility confirmed' },
  { key: 'random_sample_done', label: 'Random-sample review of non-winning entries + judge score sets' },
  { key: 'vote_integrity_done', label: 'Vote-integrity review completed' },
];