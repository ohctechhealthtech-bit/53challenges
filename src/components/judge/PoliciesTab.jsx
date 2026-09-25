// Policies — the judging policies from the parent app, plus the
// blind-judging notice.
import { useEffect, useState } from 'react';
import { EyeOff } from 'lucide-react';
import { judgeApi } from '@/lib/judgeApi';
import { PanelLoading, PanelError } from '@/components/judge/PanelStates';

export default function PoliciesTab({ refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    judgeApi('judge-policies').then(setData).catch((e) => setError(e.message));
  };
  useEffect(load, [refreshKey]);

  if (error) return <PanelError message={error} onRetry={load} />;
  if (!data) return <PanelLoading label="Loading policies…" />;

  const raw = data.policies ?? data.items ?? data;
  const sections = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? [{ title: 'Judging policies', body: raw }]
      : Object.entries(raw || {})
          .filter(([, v]) => typeof v === 'string' && v.length > 20)
          .map(([k, v]) => ({ title: k.replace(/[_-]/g, ' '), body: v }));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <EyeOff className="h-4 w-4 text-primary" /> Blind judging is in effect
        </p>
        <p className="mt-1 text-muted-foreground">
          Entrants appear as "Entrant N" and fellow judges as "Judge 1…N". Their identities and
          scores are revealed only once every judge on the panel has submitted for that entry.
        </p>
      </div>

      {sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">No additional policies have been published for this panel.</p>
      ) : (
        sections.map((s, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            {s.title && <h3 className="font-heading text-sm font-bold capitalize">{s.title}</h3>}
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{s.body || s.text || ''}</p>
          </div>
        ))
      )}
    </div>
  );
}