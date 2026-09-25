import { base44 } from '@/api/base44Client';

const call = async (payload) => {
  const res = await base44.functions.invoke('teamMessages', payload);
  return res.data;
};

export const teamMessages = {
  // Team (admin) side
  listThreads: () => call({ action: 'threads' }),
  getThread: (participant_email) => call({ action: 'thread', participant_email }),
  reply: (participant_email, body, participant_name) =>
    call({ action: 'reply', participant_email, body, participant_name }),
  // Participant side
  myUnread: () => call({ action: 'my_unread' }),
  markRead: () => call({ action: 'mark_read' }),
};