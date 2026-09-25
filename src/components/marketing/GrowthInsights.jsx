import { useState } from 'react';
import { Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { aiGrowthInsights } from '@/lib/marketing';

export default function GrowthInsights() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setData(null);
    try {
      const d = await aiGrowthInsights();
      if (d?.error) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setError(e?.message || 'Could not generate insights — please try again.');
    }
    setLoading(false);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-primary">AI growth insights</p>
          <p className="mt-1 text-sm text-muted-foreground">Reads your live audience, campaign, entry and pipeline numbers and suggests this week's highest-impact actions.</p>
        </div>
        <button onClick={run} disabled={loading} className="inline-flex items-center gap-2 rounded-xl grad-bg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Analysing…' : data ? 'Refresh insights' : 'Suggest actions'}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {data && (
        <div className="mt-5 space-y-3">
          {data.summary && <p className="text-sm text-muted-foreground">{data.summary}</p>}
          {(data.actions || []).map((a, i) => (
            <div key={i} className="rounded-xl border border-border bg-secondary p-4">
              <p className="flex items-center gap-2 text-sm font-bold"><ArrowRight className="h-4 w-4 text-primary" /> {a.title}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{a.why}</p>
              {a.first_step && <p className="mt-2 text-xs"><span className="font-semibold text-primary">First step: </span>{a.first_step}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}