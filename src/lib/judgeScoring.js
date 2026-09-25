// Client wrapper for the protected judging surface. All judging reads and
// writes go through the judgeScoring function — never direct entity access.
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/customSession';

async function call(payload) {
  // Judges sign in through the Challenge-API login, so the backend cannot see
  // them via base44.auth.me() — the signed session token is the only proof of
  // identity it gets.
  const res = await base44.functions.invoke('judgeScoring', { ...payload, session_token: getSessionToken() });
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

export const loadWorkspace = () => call({ action: 'workspace' });

export const checkIsJudge = () => call({ action: 'is_judge' });

export const submitScore = ({ panelId, entryId, scores, comments, compliance }) =>
  call({
    action: 'submit',
    panel_id: panelId,
    entry_id: entryId,
    scores,
    comments,
    compliance_flagged: !!compliance?.flagged,
    compliance_reason: compliance?.reason || '',
    compliance_note: compliance?.note || '',
  });

export const submitCalibration = ({ panelId, entryId, scores }) =>
  call({ action: 'submit_calibration', panel_id: panelId, entry_id: entryId, scores });

export const flagEntry = ({ panelId, entryId, reason, note }) =>
  call({ action: 'flag', panel_id: panelId, entry_id: entryId, compliance_reason: reason, compliance_note: note });

export const loadAdminOverview = () => call({ action: 'admin_overview' });

export const resolveFlag = (scoreId, decision) =>
  call({ action: 'resolve_flag', score_id: scoreId, decision });

export const COMPLIANCE_REASONS = [
  { value: 'off_brief', label: 'Does not meet the brief' },
  { value: 'plagiarism', label: 'Possible plagiarism' },
  { value: 'unsafe_content', label: 'Unsafe or inappropriate content' },
  { value: 'rights_or_music', label: 'Rights / music clearance concern' },
  { value: 'ineligible_entrant', label: 'Entrant may be ineligible' },
  { value: 'other', label: 'Other' },
];