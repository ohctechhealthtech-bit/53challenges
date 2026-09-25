import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import StageActionDialog from './StageActionDialog';

export default function SeasonPipelinePanel({ challengeId, data, actingEmail, onChanged }) {
  const [pending, setPending] = useState(null);
  const [winnerEntryId, setWinnerEntryId] = useState('');

  const p = data?.pipeline || {};
  const seasonChallenges = data?.season_challenges || [];
  const needsEntry = pending?.action === 'select_discipline_winner';
  const winners = p.division_winners || [];

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-bold">Season pipeline</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {p.season ? `Season ${p.season}` : 'Not part of a season'} · {p.stage_label}
            {p.is_completed ? ' · round completed' : ''}
            {p.is_archived || data?.season_archived ? ' · season archived' : ''}
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
          Top {p.top_n_advance ?? 1} per division advance
        </span>
      </div>

      {!p.applies && (
        <p className="mt-3 text-sm text-muted-foreground">
          This challenge is not linked into a season pipeline yet — closing a round still records its winners.
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Division winners</h4>
          {winners.length === 0 ? (
            <p className="mt-1.5 text-sm text-muted-foreground">No division winners recorded for this round yet.</p>
          ) : (
            <ul className="mt-1.5 space-y-1 text-sm">
              {winners.map((w) => (
                <li key={w.id || w.entry_id}>
                  <span className="font-semibold">{w.title || w.entry_title}</span>
                  <span className="text-muted-foreground"> — {w.creator_name || w.entrant_name}{w.division ? ` · ${w.division}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
          {p.discipline_winner && (
            <p className="mt-2 text-sm">
              <span className="font-semibold">Discipline winner:</span>{' '}
              {p.discipline_winner.title || p.discipline_winner.entry_title} — {p.discipline_winner.creator_name || p.discipline_winner.entrant_name}
            </p>
          )}
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Podium</h4>
          {(p.podium || []).length === 0 ? (
            <p className="mt-1.5 text-sm text-muted-foreground">No podium yet — set at the grand final close.</p>
          ) : (
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm">
              {p.podium.map((e, i) => (
                <li key={e.id || i}><span className="font-semibold">{e.title || e.entry_title}</span> — {e.creator_name || e.entrant_name}</li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(p.available_actions || []).map((a) => (
          <Button key={a.action} variant="outline" size="sm" onClick={() => { setPending(a); setWinnerEntryId(''); }}>
            {a.label}
          </Button>
        ))}
        {(p.available_actions || []).length === 0 && (
          <p className="text-sm text-muted-foreground">No season actions are available at this stage.</p>
        )}
      </div>

      {seasonChallenges.length > 0 && (
        <div className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other challenges in this season</h4>
          <div className="mt-2 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Challenge</th>
                  <th className="px-4 py-2.5">Stage</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {seasonChallenges.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-semibold">{c.title}</td>
                    <td className="px-4 py-2.5">{c.stage_label || c.stage}</td>
                    <td className="px-4 py-2.5">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pending && (
        <StageActionDialog
          open={!!pending}
          onOpenChange={(v) => !v && setPending(null)}
          action={pending}
          canConfirm={!needsEntry || !!winnerEntryId}
          run={async () => {
            return adminChallengeApi.configSeasonAction({
              challengeId,
              operation: pending.action,
              ...(needsEntry ? { entryId: winnerEntryId } : {}),
              actingEmail,
            });
          }}
          onDone={async () => { setPending(null); await onChanged(); }}
        >
          {needsEntry && (
            <div>
              <label htmlFor="sp-winner" className="mb-1.5 block text-sm font-semibold">Winning entry</label>
              <select id="sp-winner" className="c53-input" value={winnerEntryId} onChange={(e) => setWinnerEntryId(e.target.value)}>
                <option value="">Choose a division winner</option>
                {winners.map((w) => (
                  <option key={w.id || w.entry_id} value={w.id || w.entry_id}>
                    {(w.title || w.entry_title)} — {(w.creator_name || w.entrant_name)}
                  </option>
                ))}
              </select>
              {winners.length === 0 && (
                <p className="mt-1.5 text-sm text-muted-foreground">No division winners are recorded yet, so there is nothing to pick.</p>
              )}
            </div>
          )}
        </StageActionDialog>
      )}
    </section>
  );
}