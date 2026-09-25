/**
 * D8 — Host Experience Principles: plain language, no internal keys.
 * Deposit amounts shown to hosts before they send a proposal.
 */
export const HOST_DEPOSITS = {
  supported: { amount: 149, label: 'Supported package' },
  fully_managed: { amount: 299, label: 'Fully managed package' },
};

export const requiresDeposit = (deliveryLevel) => Boolean(HOST_DEPOSITS[deliveryLevel]);

export const getDeposit = (deliveryLevel) => HOST_DEPOSITS[deliveryLevel] || null;

export const formatAud = (amount) => `A$${Number(amount).toLocaleString('en-AU')}`;