import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

// A vote is either counted or blocked. Blocking recounts the entry straight away.
export default function VoteStatusButtons({ vote, challengeId, onDone }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const set = async (status) => {
    setBusy(status);
    setError('');
    try {
      const res = await adminChallengeApi.setVoteStatus({ voteId: vote.id, status, challengeId });
      onDone?.(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={!!busy || vote.status === 'valid'}
          onClick={() => set('valid')}
        >
          {busy === 'valid' ? '…' : 'Count it'}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={!!busy || vote.status === 'blocked'}
          onClick={() => set('blocked')}
        >
          {busy === 'blocked' ? '…' : 'Block'}
        </Button>
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}