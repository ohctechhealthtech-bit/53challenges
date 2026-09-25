import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import { formatDate } from './scoringMeta';

export default function ScrutineerPanel({ challengeId, actingEmail }) {
  const [data, setData] = useState(null);
  const [notApplicable, setNotApplicable] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    if (!challengeId) return;
    setLoading(true);
    setError('');
    setNotApplicable('');
    setData(null);
    try {
      const d = await adminChallengeApi.scrutineer({ challengeId });
      setData(d);
    } catch (e) {
      if (/grand.?final/i.test(e.message)) setNotApplicable('Scrutineer review only applies to a grand-final challenge.');
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => { load(); }, [load]);

  const run = async (operation, extra = {}) => {
    setBusy(operation);
    setError('');
    try {
      await adminChallengeApi.updateScrutineer({ challengeId, operation, actingEmail, ...extra });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const signedOff = !!(data?.signed_off || data?.signoff?.signed_off || data?.signoff_at);

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5">
      <h3 className="font-heading text-base font-bold">Scrutineer review</h3>

      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading the review state…</p>
      ) : notApplicable ? (
        <p className="mt-3 text-sm text-muted-foreground">{notApplicable}</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className={`rounded-full px-3 py-1 font-semibold ${signedOff ? 'bg-success/15 text-success' : 'bg-gold/15 text-gold'}`}>
              {signedOff ? `Signed off${data?.scrutineer_name ? ` by ${data.scrutineer_name}` : ''}` : 'Not signed off'}
            </span>
            {data?.voting_locked != null && (
              <span className="rounded-full bg-muted px-3 py-1">{data.voting_locked ? 'Voting locked' : 'Voting open to edits'}</span>
            )}
            {(data?.start_date || data?.end_date) && (
              <span className="rounded-full bg-muted px-3 py-1">{formatDate(data.start_date)} – {formatDate(data.end_date)}</span>
            )}
            {data?.voting_end_date && <span className="rounded-full bg-muted px-3 py-1">Voting ends {formatDate(data.voting_end_date)}</span>}
            {data?.can_complete_season != null && (
              <span className="rounded-full bg-muted px-3 py-1">{data.can_complete_season ? 'Season can be completed' : 'Season not ready to complete'}</span>
            )}
          </div>

          {Array.isArray(data?.export_contents) && data.export_contents.length > 0 && (
            <div className="mt-3 text-sm text-muted-foreground">
              Export includes: {data.export_contents.join(', ')}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="sc-name" className="mb-1.5 block text-sm font-semibold">Scrutineer name</label>
              <input id="sc-name" className="c53-input w-64" value={name} onChange={(e) => setName(e.target.value)} disabled={signedOff} />
            </div>
            <Button onClick={() => run('signoff', { scrutineerName: name.trim() })} disabled={signedOff || !name.trim() || !!busy}>
              {busy === 'signoff' ? 'Recording…' : 'Record sign-off'}
            </Button>
            <Button variant="outline" onClick={() => run('export')} disabled={!!busy}>
              {busy === 'export' ? 'Generating…' : 'Generate export'}
            </Button>
          </div>
        </>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  );
}