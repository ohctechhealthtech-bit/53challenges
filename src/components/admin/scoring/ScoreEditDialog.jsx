import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import { CRITERIA, CRITERION_MAX, criteriaFromScore, criteriaTotal, emptyCriteria, numericCriteria, validateCriteria } from './scoringMeta';

export default function ScoreEditDialog({ open, onOpenChange, challengeId, row, judges, actingEmail, onSaved }) {
  const existing = row?.judge_scores || [];
  const [judgeEmail, setJudgeEmail] = useState(existing[0]?.judge_email || judges[0]?.judge_email || '');
  const [values, setValues] = useState(existing[0] ? criteriaFromScore(existing[0]) : emptyCriteria());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const pickJudge = (email) => {
    setJudgeEmail(email);
    const match = existing.find((s) => s.judge_email === email);
    setValues(match ? criteriaFromScore(match) : emptyCriteria());
  };

  const save = async () => {
    const problem = validateCriteria(values);
    if (problem) { setError(problem); return; }
    if (!judgeEmail) { setError('Choose which judge this score belongs to.'); return; }
    setSaving(true);
    setError('');
    try {
      const criteria = numericCriteria(values);
      const res = await adminChallengeApi.updateScoring({
        challengeId,
        operation: 'save_score',
        entryId: row.entry_id,
        criteria,
        judgeEmail,
        actingEmail,
      });
      // Only treat the score as accepted when the server echoes back exactly what we sent.
      const stored = res?.saved || {};
      const mismatch = Object.entries(criteria).find(([k, v]) => Number(stored[k]) !== v);
      if (mismatch) {
        setError('The saved score came back different from what you entered, so nothing has been confirmed. Check the numbers and try again.');
        return;
      }
      onSaved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Score override</DialogTitle>
          <DialogDescription>{row?.title} · each criterion 0–{CRITERION_MAX}, one decimal place.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="se-judge" className="mb-1.5 block text-sm font-semibold">Record on behalf of</label>
            <select id="se-judge" className="c53-input" value={judgeEmail} onChange={(e) => pickJudge(e.target.value)}>
              <option value="">Choose a judge</option>
              {judges.map((j) => (
                <option key={j.judge_email} value={j.judge_email}>
                  {j.judge_name || j.judge_email}{existing.some((s) => s.judge_email === j.judge_email) ? ' — has a score' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {CRITERIA.map((c) => (
              <div key={c.key}>
                <label htmlFor={`se-${c.key}`} className="mb-1.5 block text-sm font-semibold">{c.label}</label>
                <input
                  id={`se-${c.key}`}
                  className="c53-input"
                  inputMode="decimal"
                  value={values[c.key]}
                  onChange={(e) => { setError(''); setValues({ ...values, [c.key]: e.target.value }); }}
                />
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">Total <span className="font-bold text-foreground">{criteriaTotal(values).toFixed(1)}</span>/100</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save score'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}