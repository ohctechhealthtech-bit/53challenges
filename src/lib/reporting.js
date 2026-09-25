import { base44 } from '@/api/base44Client';

export async function getReports() {
  const r = await base44.functions.invoke('reporting', {});
  return r.data || r;
}

export async function getChallengeReport(challengeId) {
  const r = await base44.functions.invoke('reporting', { challenge_id: challengeId });
  return r.data || r;
}