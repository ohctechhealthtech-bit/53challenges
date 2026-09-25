// Single-entry judging workspace: Entry / Evidence / Brief / Rules panels,
// a prev/next entry carousel and the scoring rubric.
import { useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EntryMediaView from '@/components/judge/EntryMediaView';
import RubricScoreBox from '@/components/judge/RubricScoreBox';

const PANELS = ['Entry', 'Evidence', 'Brief', 'Rules'];

export default function EntryWorkspace({ entries, index, onIndex, roundId, criteria, onBack, onScored }) {
  const [panel, setPanel] = useState('Entry');
  const entry = entries[index];
  if (!entry) return null;

  // The API sends `rules` as an array of strings and `evidence` as an object of
  // labelled fields — flatten both to plain lines before rendering.
  const toLines = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).filter(Boolean);
    if (typeof value === 'object') {
      return Object.entries(value)
        .filter(([, v]) => typeof v === 'string' && v.trim())
        .map(([k, v]) => `${k.replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase())}: ${v}`);
    }
    return [String(value)];
  };

  const evidenceLines = toLines(entry.evidence || entry.supporting_material || entry.description);
  const brief = typeof entry.brief === 'string' ? entry.brief : (entry.challenge_brief || '');
  const ruleLines = toLines(entry.rules || entry.judging_rules);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> All entries
        </Button>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Button variant="outline" size="icon" aria-label="Previous entry" disabled={index === 0} onClick={() => onIndex(index - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          Entry {index + 1} of {entries.length}
          <Button variant="outline" size="icon" aria-label="Next entry" disabled={index === entries.length - 1} onClick={() => onIndex(index + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex gap-1" role="tablist" aria-label="Entry detail panels">
            {PANELS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={panel === p}
                onClick={() => setPanel(p)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  panel === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {panel === 'Entry' && (
              <div>
                <EntryMediaView entry={entry} className="h-72 w-full sm:h-96" />
                <p className="mt-3 font-heading text-base font-bold">{entry.title || 'Untitled entry'}</p>
                <p className="text-sm text-muted-foreground">
                  {entry.participant_display_name || entry.entrant_label || entry.creator_label || entry.blind_name || 'Entrant'}
                  {entry.category && ` · ${String(entry.category).replace(/[_-]/g, ' ')}`}
                </p>
              </div>
            )}
            {panel === 'Evidence' && (
              evidenceLines.length ? (
                <div className="space-y-2">
                  {evidenceLines.map((line, i) => (
                    <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{line}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No supporting material was provided for this entry.</p>
              )
            )}
            {panel === 'Brief' && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {brief || 'No challenge brief is attached to this round.'}
              </p>
            )}
            {panel === 'Rules' && (
              ruleLines.length ? (
                <ul className="space-y-2">
                  {ruleLines.map((line, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground/90">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Standard 53 Challenges judging rules apply: score each criterion independently, do not contact entrants, and raise anything concerning with the panel administrator.
                </p>
              )
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-2 font-heading text-sm font-bold">Score this entry</h3>
          <RubricScoreBox entry={entry} roundId={roundId} criteria={criteria} onSubmitted={onScored} />
        </div>
      </div>
    </div>
  );
}