import { base44 } from '@/api/base44Client';

const call = async (payload) => {
  const res = await base44.functions.invoke('emailVerification', payload)
    .catch((err) => ({ data: { error: err?.response?.data?.error || 'Something went wrong. Please try again.' } }));
  return res?.data || {};
};

export const sendEmailCode = (email, purpose) => call({ action: 'send', email, purpose });
export const verifyEmailCode = (email, purpose, code) => call({ action: 'verify', email, purpose, code });