import { useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getSessionToken } from '@/lib/appSession';

/**
 * Comment thread for one entry — shown when the comment bubble on a card is
 * opened. Reads are public; posting requires a signed-in account.
 */
export default function CommentSection({ entryId, challengeId, onCountChange }) {
  const { isAuthenticated, user, navigateToLogin } = useAuth();
  const [comments, setComments] = useState(null);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    base44.functions.invoke('entryComments', { action: 'list', entry_id: entryId })
      .then((res) => { if (!cancelled) setComments(res?.data?.comments || []); })
      .catch(() => { if (!cancelled) setComments([]); });
    return () => { cancelled = true; };
  }, [entryId]);

  const post = async () => {
    const body = text.trim();
    if (!body) return;
    const token = getSessionToken();
    if (!isAuthenticated && !token) { navigateToLogin(); return; }
    setPosting(true);
    setError('');
    try {
      const res = await base44.functions.invoke('entryComments', {
        action: 'create',
        entry_id: entryId,
        challenge_id: challengeId || '',
        text: body,
        session_token: token,
      });
      const created = res?.data?.comment;
      if (!created) throw new Error(res?.data?.error || 'Could not post your comment.');
      const next = [created, ...(comments || [])];
      setComments(next);
      setText('');
      onCountChange?.(next.length);
    } catch (e) {
      setError(e?.message || 'Could not post your comment.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-[#FBCAB5] bg-[#FFF9F5] p-3">
      <div className="flex items-start gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          maxLength={500}
          placeholder={isAuthenticated ? 'Add a comment…' : 'Sign in to comment…'}
          className="min-h-[38px] flex-1 resize-none rounded-lg border border-[#FBCAB5] bg-white px-3 py-2 text-sm text-[#1A1A1A] placeholder:text-[#9b9b9b] focus:outline-none focus:ring-2 focus:ring-[#E86A33]/40"
        />
        <button
          onClick={post}
          disabled={posting || !text.trim()}
          className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg bg-[#E86A33] text-white transition hover:brightness-110 disabled:opacity-50"
          aria-label="Post comment"
        >
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}

      {comments === null ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-[#6b6b6b]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="mt-3 text-xs text-[#6b6b6b]">No comments yet — be the first to share your thoughts.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-white px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-bold text-[#1A1A1A]">{c.author_name || 'Anonymous'}</p>
                <p className="text-[10px] text-[#9b9b9b]">{c.created_date ? new Date(c.created_date).toLocaleDateString() : ''}</p>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-[#3a3a3a]">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}