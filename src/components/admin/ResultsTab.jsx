import { useEffect, useState } from 'react';
import { Trophy, Heart } from 'lucide-react';
import SectionToolbar from '@/components/admin/SectionToolbar';
import ResultsBlockers from '@/components/admin/results/ResultsBlockers';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

const num = (v) => (v === null || v === undefined ? '—' : v);

export default function ResultsTab({ challengeId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!challengeId) { setData(null); return; }
    setLoading(true);
    setError('');
    adminChallengeApi.results({ challengeId })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [challengeId]);

  return (
    <>
      <SectionToolbar
        section="results"
        title="Results"
        description="Official scores combining the panel judge score and the verified public vote, with the people's choice ranking alongside."
        challengeId={challengeId}
      />

      {!challengeId ? (
        <p className="mt-6 text-sm text-muted-foreground">Choose a challenge above to see its results.</p>
      ) : error ? (
        <p className="mt-6 text-sm text-destructive">{error}</p>
      ) : loading || !data ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading results…</p>
      ) : (
        <>
          {data.challenge && (
            <p className="mt-4 text-sm text-muted-foreground">
              {data.challenge.title}
              {data.challenge.round_stage ? ` · ${String(data.challenge.round_stage).replace(/_/g, ' ')}` : ''}
              {data.challenge.status ? ` · ${data.challenge.status}` : ''}
            </p>
          )}

          <ResultsBlockers rows={data.rows || []} signedOff={!!data.scrutineer_signed_off} />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SummaryCard
              icon={<Trophy className="h-5 w-5 text-gold" />}
              label="Official winner"
              winner={data.official_winner}
              extra={`Weighting ${data.weighting?.judge_weight ?? 0}% judges / ${data.weighting?.public_weight ?? 0}% public`}
            />
            <SummaryCard
              icon={<Heart className="h-5 w-5 text-pink" />}
              label="People's choice"
              winner={data.peoples_choice}
              extra={data.scrutineer_signed_off ? 'Scrutineer signed off' : 'Scrutineer sign-off pending'}
            />
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Finalist</th>
                  <th className="px-3 py-3">Division</th>
                  <th className="px-3 py-3">How they qualified</th>
                  <th className="px-3 py-3">Panel judge score</th>
                  <th className="px-3 py-3">Judge contribution</th>
                  <th className="px-3 py-3">Verified public score</th>
                  <th className="px-3 py-3">Public contribution</th>
                  <th className="px-3 py-3">Official score</th>
                  <th className="px-3 py-3">Rank</th>
                  <th className="px-3 py-3">People's choice rank</th>
                  <th className="px-3 py-3">Integrity</th>
                  <th className="px-3 py-3">Scrutineer</th>
                </tr>
              </thead>
              <tbody>
                {(data.rows || []).map((r) => (
                  <tr key={r.entry_id} className="border-t border-border">
                    <td className="px-3 py-3 font-semibold">
                      {r.title}
                      <span className="block text-xs font-normal text-muted-foreground">{r.entrant_name}</span>
                      {r.tie_break_pending && <span className="block text-xs text-gold">Tie-break pending</span>}
                      {r.chief_judge_pick && <span className="block text-xs text-primary">Chief judge pick</span>}
                      {r.is_peoples_choice_winner && <span className="block text-xs text-pink">People&apos;s choice winner</span>}
                    </td>
                    <td className="px-3 py-3">{r.division_name || '—'}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {r.qualification_route_label || (r.qualification_route || '—').replace(/_/g, ' ')}
                    </td>
                    <td className="px-3 py-3">{num(r.panel_judge_score)} <span className="text-xs text-muted-foreground">({r.judge_count} judges)</span></td>
                    <td className="px-3 py-3">{num(r.judge_contribution)}</td>
                    <td className="px-3 py-3">{num(r.verified_public_score)} <span className="text-xs text-muted-foreground">({r.verified_votes} votes)</span></td>
                    <td className="px-3 py-3">{num(r.public_contribution)}</td>
                    <td className="px-3 py-3 font-bold">{num(r.official_score)}</td>
                    <td className="px-3 py-3">{num(r.official_rank)}</td>
                    <td className="px-3 py-3">{num(r.peoples_choice_rank)}</td>
                    <td className="px-3 py-3">{(r.integrity_status || '—').replace(/_/g, ' ')}</td>
                    <td className="px-3 py-3">{(r.scrutineer_status || '—').replace(/_/g, ' ')}</td>
                  </tr>
                ))}
                {(data.rows || []).length === 0 && (
                  <tr><td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">No results for this challenge yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function SummaryCard({ icon, label, winner, extra }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{icon} {label}</p>
      {winner ? (
        <>
          <p className="mt-2 font-heading text-lg font-bold">{winner.title}</p>
          <p className="text-sm text-muted-foreground">
            {winner.entrant_name}{winner.division_name ? ` · ${winner.division_name}` : ''}
          </p>
          <p className="mt-1 text-sm">
            Score {num(winner.official_score ?? winner.verified_public_score)}
            {winner.provisional && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] font-bold">Provisional</span>}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Not decided yet.</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{extra}</p>
    </div>
  );
}