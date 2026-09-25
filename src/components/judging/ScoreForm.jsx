import { useState, useEffect } from 'react';

// Reusable blind scoring form: renders each rubric criterion as a 1–scaleMax
// slider with an optional per-criterion comment. Controlled component —
// parent owns the submit action; we only manage local input state.
export default function ScoreForm({ criteria = [], scaleMax = 10, initialScores = {}, initialComments = {}, locked = false, onSubmit, submitLabel = 'Submit scores' }) {
  const [scores, setScores] = useState({});
  const [comments, setComments] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const s = {};
    criteria.forEach((c) => { s[c.name] = initialScores[c.name] ?? 5; });
    setScores(s);
    const c = {};
    criteria.forEach((cr) => { c[cr.name] = initialComments[cr.name] ?? ''; });
    setComments(c);
  }, [criteria, initialScores, initialComments]);

  const setScore = (name, v) => setScores((s) => ({ ...s, [name]: Number(v) }));
  const setC = (name, v) => setComments((s) => ({ ...s, [name]: v }));

  const submit = async () => {
    setSubmitting(true);
    try {
      const scoresArr = criteria.map((c) => ({ name: c.name, value: scores[c.name] }));
      const commentsArr = criteria.map((c) => ({ name: c.name, text: comments[c.name] || '' })).filter((c) => c.text);
      await onSubmit?.(scoresArr, commentsArr);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {criteria.map((c) => (
        <div key={c.name} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <p className="font-semibold">{c.name} <span className="text-xs font-normal text-muted-foreground">· weight {c.weight}</span></p>
            <span className="font-heading text-2xl font-extrabold text-primary">{scores[c.name] ?? '–'}<span className="text-sm text-muted-foreground">/{scaleMax}</span></span>
          </div>
          {c.description && <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>}
          <input
            type="range" min={1} max={scaleMax} value={scores[c.name] ?? 5} disabled={locked}
            onChange={(e) => setScore(c.name, e.target.value)}
            className="mt-3 w-full accent-primary disabled:opacity-50"
          />
          <textarea
            value={comments[c.name] ?? ''} disabled={locked} rows={2} placeholder="Optional comment…"
            onChange={(e) => setC(c.name, e.target.value)}
            className="mt-2 w-full rounded-lg border border-input bg-white/5 px-3 py-2 text-xs disabled:opacity-50"
          />
        </div>
      ))}
      {!locked && (
        <button onClick={submit} disabled={submitting}
          className="w-full rounded-xl grad-bg py-3 text-sm font-bold text-white disabled:opacity-50">
          {submitting ? 'Submitting…' : submitLabel}
        </button>
      )}
      {locked && <p className="text-center text-xs text-muted-foreground">Scores locked. Corrections require a Head-Judge-approved amendment.</p>}
    </div>
  );
}