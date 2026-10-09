import { Pencil, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fmtDate, fmtFee, statusLabel, titleCase } from './challengeMeta';

export default function ChallengeTable({ challenges, onEdit, onToggleFeatured }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Challenge</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Season</th>
            <th className="px-4 py-3">Stage</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Entries</th>
            <th className="px-4 py-3">Judges</th>
            <th className="px-4 py-3">Fee</th>
            <th className="px-4 py-3">Dates</th>
            <th className="px-4 py-3">Featured</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {challenges.map((c) => (
            <tr key={c.id} className="border-t border-border align-top">
              <td className="px-4 py-3">
                <div className="font-semibold">{c.title}</div>
                {c.theme && c.theme !== c.title && <div className="text-xs text-muted-foreground">{c.theme}</div>}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{titleCase(c.category)}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {c.season || '—'}{c.state ? ` · ${c.state}` : ''}
              </td>
              <td className="px-4 py-3">
                <div>{titleCase(c.round_stage)}</div>
                <div className="text-xs text-muted-foreground">{titleCase(c.stage)}</div>
              </td>
              <td className="px-4 py-3">{statusLabel(c.status)}</td>
              <td className="px-4 py-3">
                {c.submission_count ?? 0}
                {c.pending_count > 0 && <span className="ml-1 text-xs text-muted-foreground">({c.pending_count} pending)</span>}
              </td>
              <td className="px-4 py-3">{c.judges_accepted ?? c.judge_count ?? 0}/{c.judges_required ?? 0}</td>
              <td className="px-4 py-3 text-muted-foreground">{fmtFee(c.entry_fee)}</td>
              <td className="px-4 py-3 text-muted-foreground">
                <div>{fmtDate(c.start_date)} → {fmtDate(c.end_date)}</div>
                {c.voting_end_date && <div className="text-xs">Voting ends {fmtDate(c.voting_end_date)}</div>}
              </td>
              <td className="px-4 py-3">
                {/* Featured is a flag on the challenge itself, read by the
                    home page's Featured grid, which had no way to set it. */}
                <button
                  type="button"
                  onClick={() => onToggleFeatured?.(c)}
                  aria-pressed={!!c.is_featured}
                  aria-label={c.is_featured ? 'Remove from featured' : 'Feature this challenge'}
                  title={c.is_featured ? 'Featured on the home page. Click to remove.' : 'Feature on the home page'}
                  className={'inline-flex h-8 w-8 items-center justify-center rounded-full transition ' + (c.is_featured
                    ? 'bg-amber-400/20 text-amber-400 hover:bg-amber-400/30'
                    : 'text-muted-foreground hover:bg-muted hover:text-amber-400')}
                >
                  <Star className={'h-4 w-4 ' + (c.is_featured ? 'fill-current' : '')} />
                </button>
              </td>
              <td className="px-4 py-3 text-right">
                <Button variant="outline" size="sm" onClick={() => onEdit(c)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              </td>
            </tr>
          ))}
          {challenges.length === 0 && (
            <tr><td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">No challenges match these filters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}