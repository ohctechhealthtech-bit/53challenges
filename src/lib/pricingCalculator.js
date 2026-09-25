import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/customSession';

// The SDK's functions.invoke may return either the parsed body directly
// (when the response interceptor is active) or the raw Axios response
// wrapper ({ data, status, ... }). Unwrap to the payload in either case.
const call = async (payload) => {
  const res = await base44.functions.invoke('pricingCalculator', { ...payload, session_token: getSessionToken() });
  if (res && typeof res === 'object' && 'status' in res && 'data' in res) return res.data;
  return res;
};

export const pricingCalculator = {
  getActiveRateCard: () => call({ action: 'get_active_rate_card' }),
  saveQuote: (payload) => call({ action: 'save_quote', ...payload }),
  getSavedQuote: (saved_quote_id) => call({ action: 'get_saved_quote', saved_quote_id }),
  linkQuoteToIntake: (saved_quote_id, intake_response_id) =>
    call({ action: 'link_quote_to_intake', saved_quote_id, intake_response_id }),
  getQuoteForIntake: (intake_response_id) => call({ action: 'get_quote_for_intake', intake_response_id }),
  listRateCards: () => call({ action: 'list_rate_cards' }),
  saveRateCard: (payload) => call({ action: 'save_rate_card', ...payload }),
};