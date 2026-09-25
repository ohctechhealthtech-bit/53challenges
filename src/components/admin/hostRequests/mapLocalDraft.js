// Maps a local ChallengeDraft (origin: 'host_apply', created by /host-apply) to
// the same list-item shape the parent's hostRequests.list returns, so the admin
// dashboard can show proposals alongside enquiries in one unified list.
//
// The parent has two tables: HostChallengeRequest (enquiries + /host-a-challenge
// form) and HostChallengeProposal (from /host-apply's guest_apply). The admin
// API only lists HostChallengeRequest. Proposals from /host-apply live locally
// as ChallengeDraft records, so we merge them in here.

const REVIEW_TO_PARENT_STATUS = {
  intake_received: 'new',
  submitted_for_review: 'in_review',
  builder_started: 'in_review',
  in_review: 'in_review',
  changes_requested: 'in_review',
  terms_pending: 'contacted',
  approved: 'accepted',
  approved_and_signed: 'accepted',
  live: 'accepted',
  rejected: 'declined',
};

export function mapLocalDraft(d) {
  if (!d) return null;
  const a = d.answers || {};
  return {
    id: d.id,
    working_title: d.challenge_title || '',
    company_name: a.organisation_name || a.org_name || a.contact_name || '',
    contact_name: a.contact_name || a.name || '',
    contact_email: a.contact_email || a.host_email || '',
    phone: a.contact_phone || a.phone || '',
    challenge_type: d.category || a.challenge_type || '',
    main_goal: a.primary_objective || '',
    description: d.challenge_description || '',
    participants: a.beneficiary_name || a.discovery_age || '',
    expected_participants: d.participant_range || d.scale_band || '',
    geographic_scope: a.org_state || a.reach || '',
    launch_timeframe: d.program_scope || a.timing || '',
    budget_range: a.budget || '',
    prize_format: a.prize_pool || '',
    additional_notes: [
      'Source: host application wizard (/host-apply)',
      `Package: ${d.delivery_level || ''}`,
      a.beneficiary_notes ? `Notes: ${a.beneficiary_notes}` : '',
    ].filter(Boolean).join('\n'),
    status: REVIEW_TO_PARENT_STATUS[d.review_status] || 'new',
    submitted_at: d.created_date,
    group: 'proposals',
    is_read: true,
    converted_challenge_id: d.challenge_id || '',
    _local: true,
    _main_app_proposal_id: a.main_app_proposal_id || a.main_domain_request_id || '',
  };
}

/** Maps a local ChallengeDraft to the full request shape HostRequestDetailDialog
 *  expects from hostRequests.get. */
export function mapLocalDraftToDetail(d) {
  if (!d) return null;
  const a = d.answers || {};
  return {
    request: {
      id: d.id,
      working_title: d.challenge_title || '',
      company_name: a.organisation_name || a.org_name || '',
      website: a.beneficiary_website || '',
      industry: a.org_kind || '',
      contact_name: a.contact_name || a.name || '',
      contact_email: a.contact_email || a.host_email || '',
      phone: a.contact_phone || a.phone || '',
      challenge_type: d.category || a.challenge_type || '',
      main_goal: a.primary_objective || '',
      description: d.challenge_description || '',
      participants: a.beneficiary_name || '',
      expected_participants: d.participant_range || d.scale_band || '',
      geographic_scope: a.org_state || '',
      launch_timeframe: d.program_scope || '',
      budget_range: a.budget || '',
      prize_format: a.prize_pool || '',
      additional_notes: [
        'Source: host application wizard (/host-apply)',
        `Package: ${d.delivery_level || ''}`,
        `Divisions: ${(d.divisions || []).join(', ')}`,
        `Add-ons: ${(d.addons || []).join(', ')}`,
        a.beneficiary_notes ? `Notes: ${a.beneficiary_notes}` : '',
      ].filter(Boolean).join('\n'),
      heard_about: a.template_name ? `Template: ${a.template_name}` : 'Host application wizard',
      status: REVIEW_TO_PARENT_STATUS[d.review_status] || 'new',
      submitted_at: d.created_date,
      converted_challenge_id: d.challenge_id || '',
    },
    idea_answers: [],
    messages: [],
    _local: true,
  };
}