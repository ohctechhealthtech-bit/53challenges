import { base44 } from '@/api/base44Client';

export const PROMO_PLATFORMS = [
  { k: 'instagram', l: 'Instagram', limit: 2200 },
  { k: 'facebook', l: 'Facebook', limit: 2000 },
  { k: 'tiktok', l: 'TikTok', limit: 2200 },
  { k: 'x', l: 'X', limit: 280 },
  { k: 'linkedin', l: 'LinkedIn', limit: 2500 },
  { k: 'youtube', l: 'YouTube', limit: 1000 },
  { k: 'threads', l: 'Threads', limit: 500 },
  { k: 'pinterest', l: 'Pinterest', limit: 500 },
];

export const PROMO_TONES = ['friendly', 'professional', 'playful', 'inspiring'];

async function call(payload) {
  const r = await base44.functions.invoke('participantPromo', payload);
  return r.data;
}

export const listAccounts = () => call({ action: 'listAccounts' });
export const saveAccount = (payload) => call({ action: 'saveAccount', ...payload });
export const deleteAccount = (id) => call({ action: 'deleteAccount', id });
export const myPromoEntries = () => call({ action: 'myEntries' });
export const generatePost = (payload) => call({ action: 'generatePost', ...payload });
export const listPosts = () => call({ action: 'listPosts' });
export const savePost = (payload) => call({ action: 'savePost', ...payload });
export const markShared = (id) => call({ action: 'markShared', id });
export const deletePost = (id) => call({ action: 'deletePost', id });

export function shareUrlFor(platform, text, link) {
  const t = encodeURIComponent(text.slice(0, 400));
  const u = encodeURIComponent(link);
  if (platform === 'x') return `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
  if (platform === 'facebook') return `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`;
  if (platform === 'linkedin') return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
  if (platform === 'pinterest') return `https://pinterest.com/pin/create/button/?url=${u}&description=${t}`;
  return '';
}