// Entries tab — the judge's entry list; opening one shows the workspace.
import { useEffect, useState } from 'react';
import { judgeApi, pickList } from '@/lib/judgeApi';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/judge/PanelStates';
import EntryWorkspace from '@/components/judge/EntryWorkspace';

export const ENTRY_STATUS_STYLES = {
  to_score: 'bg-primary/15 text-primary',
  in_progress: 'bg-gold/15 text-gold',
  scored: 'bg-success/15 text-success',
  locked: 'bg-secondary text-muted-foreground',
  needs_review: 'bg-purple/15 text-[hsl(var(--purple))]',
  blocked: 'bg-destructive/15 text-destructive',
};

// Judge-facing status, derived from the live API's flags — the raw `status`
// field is moderation status ("approved"), not the judging state.
export const entryStatus = (e) => {
  if (e.judge_status) return String(e.judge_status).toLowerCase().replace(/[\s-]/g, '_');
  if (e.locked) return 'locked';
  if (e.requires_admin_score_review || e.tie_break_pending) return 'needs_review';
  if (e.my_score) return 'scored';
  return 'to_score';
};

export const entryThumb = (e) =>
  e.thumbnail || e.thumb_url || e.image_url || e.media_thumbnail || '';

export default function EntriesTab({ roundId, criteria, refreshKey, onScored }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');
  const [openIndex, setOpenIndex] = useState(-1);

  const load = () => {
    setError('');
    setEntries(null);
    judgeApi('judge-entries', { round_id: roundId, page: 1, limit: 50 })
      .then((d) => setEntries(pickList(d, ['entries', 'rows', 'items'])))
      .catch((e) => setError(e.message));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [roundId, refreshKey]);

  if (error) return <PanelError message={error} onRetry={load} />;
  if (!entries) return <PanelLoading label="Loading entries…" />;
  if (!entries.length) return <PanelEmpty message="No entries in this round yet." />;

  if (openIndex >= 0) {
    return (
      <EntryWorkspace
        entries={entries}
        index={openIndex}
        onIndex={setOpenIndex}
        roundId={roundId}
        criteria={criteria}
        onBack={() => setOpenIndex(-1)}
        onScored={(entryId) => {
          setEntries((list) => list.map((e) => (String(e.id) === String(entryId) ? { ...e, judge_status: 'scored' } : e)));
          onScored?.();
        }}
      />
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((e, i) => {
        const status = entryStatus(e);
        const thumb = entryThumb(e);
        const done = e.panel_progress?.judges_submitted ?? e.panel_scored ?? e.panel_completed;
        const size = e.panel_progress?.judges_total ?? e.panel_size ?? e.panel_total;
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-primary/50"
          >
            <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-secondary">
              {thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{e.title || 'Untitled entry'}</p>
              <p className="truncate text-xs text-muted-foreground">
                {e.participant_display_name || e.entrant_label || e.creator_label || e.blind_name || 'Entrant'}
                {e.category && ` · ${String(e.category).replace(/[_-]/g, ' ')}`}
              </p>
            </div>
            {typeof done === 'number' && typeof size === 'number' && (
              <span className="hidden text-xs text-muted-foreground sm:block">Panel {done}/{size}</span>
            )}
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${ENTRY_STATUS_STYLES[status] || ENTRY_STATUS_STYLES.to_score}`}>
              {status.replace(/_/g, ' ')}
            </span>
          </button>
        );
      })}
    </div>
  );
}