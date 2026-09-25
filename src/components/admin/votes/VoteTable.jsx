import VoteStatusButtons from './VoteStatusButtons';
import { VOTE_STATUS_TONE, deviceCounts, formatCastAt, shortHash } from './votesMeta';

export default function VoteTable({ votes = [], challengeId, onChanged }) {
  const devices = deviceCounts(votes);

  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-3">Entry</th>
            <th className="px-3 py-3">Voter</th>
            <th className="px-3 py-3">Cast</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Device &amp; network</th>
            <th className="px-3 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {votes.map((v) => {
            const repeats = v.device_id ? devices[v.device_id] : 0;
            return (
              <tr key={v.id} className="border-t border-border align-top">
                <td className="px-3 py-3 font-semibold">
                  {v.entry_title || '—'}
                  {v.round && <span className="block text-xs font-normal text-muted-foreground">Round {v.round}</span>}
                </td>
                <td className="px-3 py-3">
                  {v.voter_name || 'Guest'}
                  <span className="block text-xs text-muted-foreground">{v.voter_email || '—'}</span>
                </td>
                <td className="px-3 py-3 text-muted-foreground">{formatCastAt(v.cast_at)}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${VOTE_STATUS_TONE[v.status] || 'bg-muted'}`}>
                    {v.status || '—'}
                  </span>
                  {v.flag_reason && <span className="mt-1 block text-xs text-gold">{v.flag_reason}</span>}
                  {v.integrity_decision_note && (
                    <span className="mt-1 block text-xs text-muted-foreground">{v.integrity_decision_note}</span>
                  )}
                  {v.reviewed_by && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Reviewed by {v.reviewed_by}{v.reviewed_at ? ` · ${formatCastAt(v.reviewed_at)}` : ''}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">
                  <span title={v.device_id || ''}>Device {shortHash(v.device_id)}</span>
                  {repeats > 1 && (
                    <span className="ml-1 rounded bg-gold/20 px-1.5 py-0.5 font-bold text-gold">{repeats} votes</span>
                  )}
                  <span className="block" title={v.ip_hash || ''}>Network {shortHash(v.ip_hash)}</span>
                  {v.user_agent && <span className="mt-1 block max-w-[220px] truncate" title={v.user_agent}>{v.user_agent}</span>}
                </td>
                <td className="px-3 py-3">
                  <VoteStatusButtons vote={v} challengeId={challengeId} onDone={onChanged} />
                </td>
              </tr>
            );
          })}
          {votes.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No votes in this view.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}