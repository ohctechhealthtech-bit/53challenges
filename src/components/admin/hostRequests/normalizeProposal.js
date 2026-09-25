/**
 * Maps a ChallengeDraft record (the child app's proposal shape, where most
 * host-entered data lives under `answers`) to the flat field shape the
 * ProposalReviewCard / ProposalDetailsPanel components expect.
 */
export function normalizeProposal(p) {
  if (!p) return null;
  const a = p.answers || {};
  const routing = a.routing || {};
  const price = a.main_app_price || {};
  return {
    ...p,
    title: p.challenge_title || p.title || p.theme || '',
    theme: a.theme || p.theme || p.challenge_title || '',
    description: p.challenge_description || a.challenge_description || p.brief || '',
    status: p.review_status || p.status || 'submitted_for_review',
    risk_level: routing.risk_level || p.risk_level || 'low',
    risk_factors: [...(p.compliance_flags || []), ...(routing.risk_factors || [])],
    host_type: p.host_type || a.host_type || '',
    content_type: p.content_type || a.content_type || 'admin_managed',
    beneficiary_for: a.beneficiary_for || '',
    beneficiary_name: a.beneficiary_name || a.organisation_name || a.org_name || '',
    beneficiary_notes: a.beneficiary_notes || '',
    beneficiary_contact_name: a.beneficiary_contact_name || a.contact_name || '',
    beneficiary_contact_role: a.beneficiary_contact_role || '',
    beneficiary_contact_email: a.beneficiary_contact_email || a.contact_email || a.host_email || '',
    beneficiary_phone: a.beneficiary_phone || a.contact_phone || '',
    beneficiary_website: a.beneficiary_website || '',
    category: p.category || a.category || '',
    accepted_entry_types: a.accepted_entry_types || a.work_type || '',
    age_divisions: p.divisions || a.age_divisions || a.divisions || [],
    state: a.state || p.state || '',
    season: a.season || p.season || '',
    start_date: a.start_date || p.starts_at || '',
    end_date: a.end_date || p.submission_ends_at || '',
    voting_end_date: a.voting_end_date || p.voting_ends_at || '',
    entry_fee: a.entry_fee || 0,
    prize_budget: a.prize_budget || 0,
    expected_entries: a.expected_entries || '',
    service_package: p.service_tier || a.service_package || a.delivery_level || '',
    program_scope: p.program_scope || a.program_scope || 'single',
    series_count: a.series_count || '',
    series_cadence: a.series_cadence || '',
    template_key: a.template_id || a.template_key || '',
    addon_keys: p.addons || a.addons || a.addon_keys || [],
    base_price: price.base_price || price.package_price || 0,
    addons_price: price.addons_price || 0,
    total_price: price.total_price || 0,
    amount_paid: a.amount_paid || 0,
    payment_status: a.payment_status || '',
    application_invoice_id: a.application_invoice_id || a.main_app_invoice_id || '',
    cover_image: a.cover_image || p.cover_image || '',
    quotation_text: a.quotation_text || '',
    decision_reason: p.admin_feedback || p.decline_reason || '',
  };
}