// The white scoring card overlaid across the bottom of a reel entry:
// "SCORE EACH CRITERION / 25" + running total, the four criteria in one row,
// and the privacy note that becomes "Scored" once saved.
import { useState } from 'react';
import { Loader2, Lock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { judgeApi } from '@/lib/judgeApi';
import {
  MAX_PER_CRITERION, SCORE_STEP, MAX_TOTAL, CRITERIA,
  validateScores, totalOf, loadDraft, saveDraft, clearDraft,
} from '@/lib/judgeRubric';

export default function ReelScoreCard({ entry, roundId, criteria, scored, savedTotal, onSubmitted }) {
  const list = criteria?.length ? criteria : CRITERIA;
  const [values, setValues] = useState(() => loadDraft(entry.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      const payload = {};
      for (const c of CRITERIA) payload[c.key] = Number(values[c.key]);
      await judgeApi('judge-score', { entry_id: entry.id, round_id: roundId, criteria: payload });
      clearDraft(entry.id);
      onSubmitted?.(entry.id, totalOf(values));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-4 text-slate-900 shadow-2xl">
          <div className="flex items-end justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Score each criterion / {MAX_PER_CRITERION}
            </p>
            <p className="font-heading text-xl font-extrabold leading-none text-teal-600">
              {scored ? (savedTotal ?? totalOf(values)) : totalOf(values)}
              <span className="ml-1 text-sm font-semibold text-slate-400">/{MAX_TOTAL}</span>
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {list.map((c) => (
              <div key={c.key}>
                <label
                  htmlFor={`reel-${entry.id}-${c.key}`}
                  className="mb-1 block text-[11px] font-semibold leading-tight text-slate-600"
                >
                  {c.label}
                </label>
                <input
                  id={`reel-${entry.id}-${c.key}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={MAX_PER_CRITERION}
                  step={SCORE_STEP}
                  disabled={scored}
                  value={values[c.key] ?? ''}
                  onChange={(ev) => setScore(c.key, ev.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-sm font-semibold text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                  aria-label={`${c.label}, 0 to ${MAX_PER_CRITERION}`}
                />
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            {scored ? (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Scored
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Lock className="h-3.5 w-3.5" /> Hidden from other judges
              </p>
            )}
            {!scored && (
              <Button size="sm" onClick={submit} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Submit score
              </Button>
            )}
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}