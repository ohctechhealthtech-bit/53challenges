// The scoring rubric: four criteria, 0–25 each in 0.5 steps, 100 total.
// Drafts persist locally; submitted scores POST to the parent Judge API.
// The conflict-of-interest confirmation happens once per assignment, in the
// Assignments tab — not per entry.
import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { judgeApi } from '@/lib/judgeApi';
import {
  MAX_PER_CRITERION, SCORE_STEP, MAX_TOTAL, CRITERIA,
  validateScores, totalOf, loadDraft, saveDraft, clearDraft,
} from '@/lib/judgeRubric';

export default function RubricScoreBox({ entry, roundId, criteria, compact = false, onSubmitted }) {
  const list = criteria?.length ? criteria : CRITERIA;
  const [values, setValues] = useState(() => loadDraft(entry.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const alreadyScored = (e) =>
    !!e.my_score || (e.judge_status || '').toString().toLowerCase() === 'scored';
  const [done, setDone] = useState(() => alreadyScored(entry));

  useEffect(() => {
    setValues(loadDraft(entry.id));
    setError('');
    setDone(alreadyScored(entry));
  }, [entry.id, roundId, entry.category, entry.judge_status, entry.status]);

  const setScore = (key, raw) => {
    const next = { ...values, [key]: raw };
    setValues(next);
    saveDraft(entry.id, next);
  };

  const submit = async () => {
    const invalid = validateScores(values);
    if (invalid) { setError(invalid); return; }
    setSaving(true);
    setError('');
    try {
      const criteriaPayload = {};
      for (const c of CRITERIA) criteriaPayload[c.key] = Number(values[c.key]);
      await judgeApi('judge-score', { entry_id: entry.id, round_id: roundId, criteria: criteriaPayload });
      clearDraft(entry.id);
      setDone(true);
      onSubmitted?.(entry.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 p-4 text-sm font-semibold text-success">
        <CheckCircle2 className="h-4 w-4" /> Score submitted for this entry
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-border bg-card ${compact ? 'p-3' : 'p-4'}`}>
      <div className="space-y-2">
        {list.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-3">
            <label htmlFor={`score-${entry.id}-${c.key}`} className={`${compact ? 'text-xs' : 'text-sm'} font-medium`}>
              {c.label}
            </label>
            <input
              id={`score-${entry.id}-${c.key}`}
              type="number"
              inputMode="decimal"
              min={0}
              max={MAX_PER_CRITERION}
              step={SCORE_STEP}
              value={values[c.key] ?? ''}
              onChange={(e) => setScore(c.key, e.target.value)}
              className="c53-input w-20 text-right"
              aria-label={`${c.label}, 0 to ${MAX_PER_CRITERION}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <p className={`${compact ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
          Total <span className="font-heading font-bold text-foreground">{totalOf(values)}</span> / {MAX_TOTAL}
        </p>
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Submit score
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}