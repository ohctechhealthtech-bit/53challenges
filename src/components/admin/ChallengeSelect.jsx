export default function ChallengeSelect({ challenges, value, onChange }) {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-4">
      <label htmlFor="admin-selected-challenge" className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Selected challenge
      </label>
      <select
        id="admin-selected-challenge"
        className="c53-input mt-2 max-w-xl"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose a challenge…</option>
        {(challenges || []).map((c) => (
          <option key={c.id} value={c.id}>
            {c.title} — {c.status} · {c.submission_count ?? 0} entries
          </option>
        ))}
      </select>
    </div>
  );
}