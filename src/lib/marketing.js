import { base44 } from '@/api/base44Client';

export const AUDIENCE_TYPES = ['creator', 'voter', 'sponsor', 'parent', 'educator', 'other'];
export const ORG_KINDS = ['school', 'club', 'workplace', 'council'];
export const CATEGORIES = ['Writing', 'Music', 'Visual Art', 'Photography', 'Dance', 'Film', 'Design', 'Comedy', 'Craft', 'Spoken Word'];
export const CAMPAIGN_TYPES = ['announcement', 'deadline_reminder', 'results', 'voting_open', 'results_announced'];

export async function addAudienceMember(data) {
  const r = await base44.functions.invoke('marketingHub', { action: 'addAudience', ...data });
  return r.data;
}
export async function listAudience(segment) {
  const r = await base44.functions.invoke('marketingHub', { action: 'listAudience', ...segment });
  return r.data;
}
export async function unsubscribeAudience(email) {
  const r = await base44.functions.invoke('marketingHub', { action: 'unsubscribe', email });
  return r.data;
}
export async function createCampaign(data) {
  const r = await base44.functions.invoke('marketingHub', { action: 'createCampaign', ...data });
  return r.data;
}
export async function sendCampaign(campaign_id) {
  const r = await base44.functions.invoke('marketingHub', { action: 'sendCampaign', campaign_id });
  return r.data;
}
export async function sendLifecycle(lifecycle_type, recipient_email, recipient_name, context) {
  const r = await base44.functions.invoke('marketingHub', { action: 'sendLifecycle', lifecycle_type, recipient_email, recipient_name, context });
  return r.data;
}
export async function listOrganisations() {
  const r = await base44.functions.invoke('marketingHub', { action: 'listOrganisations' });
  return r.data;
}
export async function createOrganisation(data) {
  const r = await base44.functions.invoke('marketingHub', { action: 'createOrganisation', ...data });
  return r.data;
}
export async function organisationLeaderboard(organisation_id) {
  const r = await base44.functions.invoke('marketingHub', { action: 'organisationLeaderboard', organisation_id });
  return r.data;
}
export async function mySponsorProfile() {
  const r = await base44.functions.invoke('marketingHub', { action: 'mySponsorProfile' });
  return r.data;
}
export async function applyAsSponsor(data) {
  const r = await base44.functions.invoke('marketingHub', { action: 'applyAsSponsor', ...data });
  return r.data;
}
export async function listSponsors() {
  const r = await base44.functions.invoke('marketingHub', { action: 'listSponsors' });
  return r.data;
}
export async function saveSponsor(data) {
  const r = await base44.functions.invoke('marketingHub', { action: 'saveSponsor', ...data });
  return r.data;
}
export async function deleteSponsor(id) {
  const r = await base44.functions.invoke('marketingHub', { action: 'deleteSponsor', id });
  return r.data;
}
export async function listCampaigns() {
  const r = await base44.functions.invoke('marketingHub', { action: 'listCampaigns' });
  return r.data;
}
export async function listPipeline() {
  const r = await base44.functions.invoke('marketingHub', { action: 'listPipeline' });
  return r.data;
}
export async function updatePipelineStatus(id, pipeline_status) {
  const r = await base44.functions.invoke('marketingHub', { action: 'updatePipelineStatus', id, pipeline_status });
  return r.data;
}
export async function generateShareCard(payload) {
  const r = await base44.functions.invoke('marketingHub', { action: 'generateShareCard', ...payload });
  return r.data;
}
export async function dashboardSummary() {
  const r = await base44.functions.invoke('marketingHub', { action: 'dashboardSummary' });
  return r.data;
}
export async function aiFindPartners(payload) {
  const r = await base44.functions.invoke('marketingHub', { action: 'aiFindPartners', ...payload });
  return r.data;
}
export async function aiGenerateInvite(payload) {
  const r = await base44.functions.invoke('marketingHub', { action: 'aiGenerateInvite', ...payload });
  return r.data;
}
export async function aiGrowthInsights() {
  const r = await base44.functions.invoke('marketingHub', { action: 'aiGrowthInsights' });
  return r.data;
}
export async function aiCampaignCopy(payload) {
  const r = await base44.functions.invoke('marketingHub', { action: 'aiCampaignCopy', ...payload });
  return r.data;
}
export async function aiFollowUpDraft(id) {
  const r = await base44.functions.invoke('marketingHub', { action: 'aiFollowUpDraft', id });
  return r.data;
}
export async function savePartnerProspect(payload) {
  const r = await base44.functions.invoke('marketingHub', { action: 'savePartnerProspect', ...payload });
  return r.data;
}
export async function listCanonicalCategories() {
  const r = await base44.functions.invoke('marketingHub', { action: 'listCanonicalCategories' });
  return r.data;
}