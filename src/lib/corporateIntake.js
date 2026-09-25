import { base44 } from '@/api/base44Client';

// All calls unwrap the function response so callers get the payload directly.
const call = async (payload) => {
  const res = await base44.functions.invoke('corporateIntake', payload);
  return res?.data ?? res;
};

export const corporateIntake = {
  getQuestionnaire: () => call({ action: 'get_questionnaire' }),
  listAccountTypes: () => call({ action: 'list_account_types' }),
  listServiceTiers: () => call({ action: 'list_service_tiers' }),
  submitIntake: (payload) => call({ action: 'submit_intake', ...payload }),
  getRecommendation: (response_id) => call({ action: 'get_recommendation', response_id }),
  listResponses: (filter = {}) => call({ action: 'list_responses', filter }),
  getResponseDetail: (response_id) => call({ action: 'get_response_detail', response_id }),
  listQuestionnaires: () => call({ action: 'list_questionnaires' }),
  createQuestionnaireVersion: (source_questionnaire_id, change_note) => call({ action: 'create_questionnaire_version', source_questionnaire_id, change_note }),
  // Service Delivery (Prompt 23)
  listScaleBands: () => call({ action: 'list_scale_bands' }),
  listDeliverables: () => call({ action: 'list_deliverables' }),
  listResourceTypes: () => call({ action: 'list_resource_types' }),
  getServiceDelivery: (draft_id) => call({ action: 'get_service_delivery', draft_id }),
  updateDraftDeliverables: (draft_id, deliverables) => call({ action: 'update_draft_deliverables', draft_id, deliverables }),
  updateDraftScaleBand: (draft_id, scale_band_id) => call({ action: 'update_draft_scale_band', draft_id, scale_band_id }),
  computeQuote: (draft_id, allocations, packaged_floor) => call({ action: 'compute_quote', draft_id, allocations, packaged_floor }),
  saveQuote: (payload) => call({ action: 'save_quote', ...payload }),
  acceptQuote: (quote_id) => call({ action: 'accept_quote', quote_id }),
  declineQuote: (quote_id) => call({ action: 'decline_quote', quote_id }),
  setDraftStatus: (draft_id, review_status) => call({ action: 'set_draft_status', draft_id, review_status }),
  publishToMain: (payload) => call({ action: 'publish_to_main', ...payload }),
};