// The white scoring box used in both the list card and the reel panel.
// Submits straight to the parent Judge API and keeps a local draft.
import { useState } from 'react';
import { Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { judgeApi } from '@/lib/judgeApi';
import {
  CRITERIA, MAX_PER_CRITERION, MAX_TOTAL, SCORE_STEP,
  validateScores, totalOf, loadDraft, saveDraft, clearDraft,
} from '@/lib/judgeRubric';

export default function JudgeScoreBox({ row, roundId, criteria, onScored, onSubmitted }) {
  const entry = row.entry;
  const list = criteria?.length ? criteria : CRITERIA;
  const [values, setValues] = useState(() => loadDraft(entry.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const scored = row.scored;
  const total = totalOf(values);

  const setVal = (key, raw) => {
    const next = { ...values, [key]: raw };
    setValues(next);
    saveDraft(entry.id, next);
    setError('');
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
      setJustSaved(true);
      onSubmitted?.(entry.id, total);
      setTimeout(() => { setJustSaved(false); onScored?.(); }, 700);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-5 border-t border-stone-100 pt-4" data-reel-no-swipe>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
          Score each criterion / {MAX_PER_CRITERION}
        </p>
        <p className="text-sm font-bold text-teal-700">
          {(scored ? (row.savedTotal ?? total) : total).toFixed(1)}
          <span className="text-stone-400"> /{MAX_TOTAL}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {list.map((c) => (
          <label key={c.key} className="block">
            <span className="mb-1 block truncate text-[11px] font-semibold text-stone-600">{c.label}</span>
            <input
              type="number"
              min="0"
              max={MAX_PER_CRITERION}
              step={SCORE_STEP}
              inputMode="decimal"
              disabled={scored}
              value={values[c.key] ?? ''}
              onChange={(e) => setVal(c.key, e.target.value)}
              placeholder="0"
              aria-label={`${c.label}, 0 to ${MAX_PER_CRITERION}`}
              className="h-10 w-full rounded-lg border border-stone-300 bg-white text-center text-base font-bold text-stone-900 disabled:bg-stone-100 disabled:text-stone-400"
            />
          </label>
        ))}
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-xs font-semibold text-red-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        {justSaved ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-700">
            <CheckCircle2 className="h-4 w-4" /> Saved — {total.toFixed(1)}/{MAX_TOTAL}
          </span>
        ) : scored ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Scored
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-stone-500">
            <Lock className="h-3 w-3" /> Hidden from other judges
          </span>
        )}
        <div className="flex-1" />
        {!scored && (
          <Button
            size="sm"
            disabled={saving}
            onClick={submit}
            className="bg-orange-600 px-5 text-white hover:bg-orange-700"
          >
            {saving ? 'Saving…' : 'Submit & Next'}
          </Button>
        )}
      </div>
    </div>
  );
}