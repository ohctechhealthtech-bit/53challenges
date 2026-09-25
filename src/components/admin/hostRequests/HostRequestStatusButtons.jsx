import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import { allowedStatuses, STATUS_LABELS } from './hostRequestMeta';

// Status transitions for one request. Already-converted requests keep their
// buttons visible but disabled, the way the parent locks a converted enquiry.
export default function HostRequestStatusButtons({ request, onDone }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const converted = !!(request.converted_challenge_id || request.challenge_id);
  const options = allowedStatuses(request.status);

  const change = async (status) => {
    setBusy(status);
    setError('');
    try {
      await adminChallengeApi.updateHostRequest({ id: request.id, status });
      onDone?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((s) => (
        <Button
          key={s}
          size="sm"
          variant={s === 'accepted' ? 'default' : s === 'declined' ? 'destructive' : 'outline'}
          disabled={!!busy || converted}
          title={converted ? 'Already converted into a challenge' : undefined}
          onClick={() => change(s)}
        >
          {busy === s && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {STATUS_LABELS[s]}
        </Button>
      ))}
      {converted && <span className="text-xs text-muted-foreground">Converted</span>}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}