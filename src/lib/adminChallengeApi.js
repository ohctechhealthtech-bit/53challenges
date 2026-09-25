import { base44 } from '@/api/base44Client';
import { getSessionToken, clearSessionToken } from '@/lib/customSession';

// Thin client for the adminChallenge backend proxy, which forwards to the
// parent app's adminChallengeApi. Always returns the parent payload shape:
// { ok: true, data } | { ok: false, error: { code, message } }
//
// Stale-session handling: when the proxy's admin check fails (code "forbidden")
// the user's session is dead — clear it and send them to sign in.
function handleAuthFailure(data) {
  // Only redirect on the child proxy's own admin-check failure (lowercase
  // "forbidden"). The parent's UPPERCASE "UNAUTHORIZED"/"FORBIDDEN" codes mean
  // the API key lacks access — a config issue, not a stale session.
  if (data?.error?.code === 'forbidden') {
    clearSessionToken();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
}

export async function adminChallengeCall(action, params = {}) {
  try {
    const res = await base44.functions.invoke('adminChallenge', { action, params, session_token: getSessionToken() });
    if (res?.data?.ok === false) handleAuthFailure(res.data);
    return res.data;
  } catch (err) {
    const data = err?.response?.data ?? err?.data;
    if (data && data.ok === false) {
      handleAuthFailure(data);
      return data;
    }
    return { ok: false, error: { code: 'request_failed', message: err?.message || 'Request failed' } };
  }
}

// Throwing variant for UI code that wants try/catch.
export async function adminChallengeData(action, params = {}) {
  const res = await adminChallengeCall(action, params);
  if (!res || res.ok !== true) {
    const e = res?.error || {};
    throw new Error(`${e.code || 'error'}: ${e.message || 'Unknown error from the parent app'}`);
  }
  return res.data;
}

export const adminChallengeApi = {
  metaActions: () => adminChallengeData('meta.actions'),
  reference: (params) => adminChallengeData('reference.list', params),
  listChallenges: (params) => adminChallengeData('challenges.list', params),
  getChallenge: (params) => adminChallengeData('challenges.get', params),
  createChallenge: (params) => adminChallengeData('challenges.create', params),
  updateChallenge: (params) => adminChallengeData('challenges.update', params),
  listEntries: (params) => adminChallengeData('entries.list', params),
  updateEntry: (params) => adminChallengeData('entries.update', params),
  results: (params) => adminChallengeData('results.get', params),
  votes: (params) => adminChallengeData('votes.get', params),
  setVoteStatus: (params) => adminChallengeData('votes.setStatus', params),
  recalcVoteTotals: (params) => adminChallengeData('votes.recalcTotals', params),
  listSponsors: (params) => adminChallengeData('sponsors.list', params),
  getSponsor: (params) => adminChallengeData('sponsors.get', params),
  createSponsor: (params) => adminChallengeData('sponsors.create', params),
  updateSponsor: (params) => adminChallengeData('sponsors.update', params),
  deleteSponsor: (params) => adminChallengeData('sponsors.delete', params),
  getSponsorApplication: (params) => adminChallengeData('sponsorApplications.get', params),
  decideSponsorApplication: (params) => adminChallengeData('sponsorApplications.decide', params),
  contactSponsorApplication: (params) => adminChallengeData('sponsorApplications.contact', params),
  funds: (params) => adminChallengeData('funds.get', params),
  fundsUpdate: (operation, params) => adminChallengeData('funds.update', { operation, ...params }),
  exclusions: () => adminChallengeData('exclusions.list'),
  addExclusion: (params) => adminChallengeData('exclusions.add', params),
  removeExclusion: (params) => adminChallengeData('exclusions.remove', params),
  listApprovals: (params) => adminChallengeData('approvals.list', params),
  getApproval: (params) => adminChallengeData('approvals.get', params),
  decideApproval: (params) => adminChallengeData('approvals.decide', params),
  scoringBoard: (params) => adminChallengeData('scoring.get', params),
  scoringJudges: (params) => adminChallengeData('scoring.judges', params),
  updateScoring: (params) => adminChallengeData('scoring.update', params),
  resolveScoringTie: (params) => adminChallengeData('scoring.resolveTie', params),
  scrutineer: (params) => adminChallengeData('scrutineer.get', params),
  updateScrutineer: (params) => adminChallengeData('scrutineer.update', params),
  configGet: (params) => adminChallengeData('config.get', params),
  configReference: (params) => adminChallengeData('config.reference', params),
  configSeasonPipeline: (params) => adminChallengeData('config.seasonPipeline', params),
  configSetStage: (params) => adminChallengeData('config.setStage', params),
  configSelectFinalists: (params) => adminChallengeData('config.selectFinalists', params),
  configOpenFinalRound: (params) => adminChallengeData('config.openFinalRound', params),
  configComputeResults: (params) => adminChallengeData('config.computeResults', params),
  configUpdateInfluence: (params) => adminChallengeData('config.updateInfluence', params),
  configSeasonAction: (params) => adminChallengeData('config.seasonAction', params),
  configPreviewSeason: (params) => adminChallengeData('config.previewSeason', params),
  configCreateSeason: (params) => adminChallengeData('config.createSeason', params),
  judgePanel: (params) => adminChallengeData('judgePanel.get', params),
  judgePanelMember: (params) => adminChallengeData('judgePanel.getMember', params),
  judgePanelAssign: (params) => adminChallengeData('judgePanel.assign', params),
  judgePanelRemove: (params) => adminChallengeData('judgePanel.remove', params),
  judgePanelAddJudge: (params) => adminChallengeData('judgePanel.addJudge', params),
  listJudges: (params) => adminChallengeData('judges.list', params),
  getJudge: (params) => adminChallengeData('judges.get', params),
  createJudge: (params) => adminChallengeData('judges.create', params),
  updateJudge: (params) => adminChallengeData('judges.update', params),
  judgeAssignments: (params) => adminChallengeData('judges.assignments.list', params),
  assignJudge: (params) => adminChallengeData('judges.assign', params),
  unassignJudge: (params) => adminChallengeData('judges.unassign', params),
  judgeApplications: (params) => adminChallengeData('judgeApplications.list', params),
  judgeApplication: (params) => adminChallengeData('judgeApplications.get', params),
  decideJudgeApplication: (params) => adminChallengeData('judgeApplications.decide', params),
  listHostRequests: (params) => adminChallengeData('hostRequests.list', params),
  getHostRequest: (params) => adminChallengeData('hostRequests.get', params),
  updateHostRequest: (params) => adminChallengeData('hostRequests.update', params),
  hostRequestConvertPrefill: (params) => adminChallengeData('hostRequests.convertPrefill', params),
  hostRequestConvert: (params) => adminChallengeData('hostRequests.convert', params),
  mastersGet: (params) => adminChallengeData('masters.get', params),
  mastersCategoryCreate: (params) => adminChallengeData('masters.categories.create', params),
  mastersCategoryUpdate: (params) => adminChallengeData('masters.categories.update', params),
  mastersCategoryDelete: (params) => adminChallengeData('masters.categories.delete', params),
  mastersPackagesSeedDefaults: () => adminChallengeData('masters.packages.seedDefaults'),
  mastersPackageCreate: (params) => adminChallengeData('masters.packages.create', params),
  mastersPackageUpdate: (params) => adminChallengeData('masters.packages.update', params),
  mastersPackageDelete: (params) => adminChallengeData('masters.packages.delete', params),
  mastersServiceCreate: (params) => adminChallengeData('masters.services.create', params),
  mastersServiceUpdate: (params) => adminChallengeData('masters.services.update', params),
  mastersServiceDelete: (params) => adminChallengeData('masters.services.delete', params),
  mastersTemplateCreate: (params) => adminChallengeData('masters.templates.create', params),
  mastersTemplateUpdate: (params) => adminChallengeData('masters.templates.update', params),
  mastersTemplateDelete: (params) => adminChallengeData('masters.templates.delete', params),
  stats: (params) => adminChallengeData('stats.get', params),
  auditExport: (params) => adminChallengeData('audit.export', params),
  guide: (params) => adminChallengeData('guide.get', params),
  analysis: (params) => adminChallengeData('analysis.run', params),
};