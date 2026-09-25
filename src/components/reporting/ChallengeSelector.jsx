import { Loader2 } from 'lucide-react';

export default function ChallengeSelector({ challenges, value, onChange, loading }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <label className="text-sm font-semibold text-muted-foreground">Challenge</label>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="c53-input max-w-md flex-1"
        >
          <option value="">All Challenges (platform-wide)</option>
          {challenges.map((c) => (
            <option key={c.id} value={c.id}>
              {c.theme || c.title || 'Untitled'}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}