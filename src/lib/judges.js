// Shared helpers for the Judge Management module.
// Category expertise uses the configurable category names from the new engine
// spec — stored as plain strings on JudgeProfile until the Category lookup
// entities (Prompt 1) are in place, at which point these become linked ids.

export const JUDGE_CATEGORIES = [
  'Outdoor & Adventure',
  'Art, Craft & Making',
  'Music, Dance & Performance',
  'Photography, Film & Digital',
  'Writing, Ideas & Innovation',
  'Food, Farming & Community',
];

export const JUDGE_STATES = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

export const AVAILABILITY_OPTIONS = [
  'Weekdays',
  'Weekends',
  'Evenings',
  'Any time',
];

// Category slugs accepted by the external judge-application API
// (POST publicChallengeApi action=submit_judge_application).
export const JUDGE_APPLICATION_CATEGORIES = [
  { slug: 'visual_arts', label: 'Visual Arts' },
  { slug: 'photography', label: 'Photography' },
  { slug: 'writing_storytelling', label: 'Writing & Storytelling' },
  { slug: 'digital_creativity', label: 'Digital Creativity' },
  { slug: 'performance_voice', label: 'Performance & Voice' },
  { slug: 'dance', label: 'Dance' },
  { slug: 'open_experimental', label: 'Open / Experimental' },
];

export const JUDGE_AVAILABILITY = [
  { slug: 'weekdays', label: 'Weekdays' },
  { slug: 'weekends', label: 'Weekends' },
  { slug: 'evenings', label: 'Evenings' },
  { slug: 'any_time', label: 'Any time' },
];

export const COI_TYPES = [
  { value: 'club', label: 'Club' },
  { value: 'school', label: 'School' },
  { value: 'workplace', label: 'Workplace' },
  { value: 'family', label: 'Family member' },
];

export const STATUS_FLOW = ['applicant', 'approved', 'active', 'suspended', 'retired', 'rejected'];

export const STATUS_LABELS = {
  applicant: 'Applicant',
  approved: 'Approved',
  active: 'Active',
  suspended: 'Suspended',
  retired: 'Retired',
  rejected: 'Rejected',
};

export const STATUS_STYLES = {
  applicant: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  approved: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  suspended: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  retired: 'bg-muted text-muted-foreground border-border',
  rejected: 'bg-destructive/15 text-destructive border-destructive/30',
};

export const ROLES = ['manager', 'judge', 'auditor'];
export const ROLE_LABELS = { manager: 'Competition Manager', judge: 'Judge', auditor: 'Auditor' };

// A WWCC is "current" only if status === 'current' and the expiry date has not
// passed. 'applied' is not current (cannot serve on WWCC-required comps).
export function wwccCurrent(profile) {
  if (!profile) return false;
  if (profile.wwcc_status !== 'current') return false;
  if (!profile.wwcc_expiry) return false;
  return new Date(profile.wwcc_expiry).getTime() >= Date.now();
}

export function wwccLabel(profile) {
  if (!profile) return 'None';
  if (profile.wwcc_status === 'current' && wwccCurrent(profile)) return 'Current';
  if (profile.wwcc_status === 'current') return 'Expired';
  return profile.wwcc_status ? profile.wwcc_status.charAt(0).toUpperCase() + profile.wwcc_status.slice(1) : 'None';
}

// Enforces: only Active judges can be assigned; WWCC-required competitions
// require a current WWCC.
export function canAssignJudge(profile, competitionRequiresWWCC) {
  if (!profile) return { ok: false, reason: 'No judge profile.' };
  if (profile.status !== 'active') {
    return { ok: false, reason: `Judge is ${STATUS_LABELS[profile.status] || profile.status} — only Active judges can be assigned.` };
  }
  if (competitionRequiresWWCC && !wwccCurrent(profile)) {
    return { ok: false, reason: 'This competition requires a Working With Children check. The judge\'s WWCC is not current.' };
  }
  return { ok: true };
}

// Enforces role separation: no account (judge profile) may hold more than one
// role on the same competition.
export function checkRoleSeparation(existingAssignments, competitionId, judgeProfileId, role) {
  const conflict = (existingAssignments || []).find(
    (a) => a.competition_id === competitionId &&
          a.judge_profile_id === judgeProfileId &&
          a.role !== role &&
          a.status === 'active'
  );
  if (conflict) {
    return {
      ok: false,
      reason: `Role separation: this person is already assigned as ${ROLE_LABELS[conflict.role]} on this competition. An account may hold only one role per competition.`,
    };
  }
  return { ok: true };
}