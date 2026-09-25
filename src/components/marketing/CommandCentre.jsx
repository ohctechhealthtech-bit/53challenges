import { useEffect, useState } from 'react';
import { Users, Trophy, Mail, Building2, Loader2, AlertTriangle, ArrowRight, BarChart3 } from 'lucide-react';
import { dashboardSummary } from '@/lib/marketing';
import GrowthInsights from './GrowthInsights';

function Stat({ label, value, detail, icon: Icon }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
        </div>
        <div className="rounded-xl grad-soft-bg p-2.5 text-primary"><Icon className="h-5 w-5" /></div>
      </div>
      {detail && <p className="mt-3 text-xs text-muted-foreground">{detail}</p>}
    </article>
  );
}

export default function CommandCentre({ onGoTo }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError('');
      try {
        const d = await dashboardSummary();
        if (d?.error) throw new Error(d.error);
        if (!cancelled) setData(d);
      } catch {
        // Retry once — the summary aggregates several sources and can time out.
        try {
          await new Promise((r) => setTimeout(r, 1200));
          const d = await dashboardSummary();
          if (d?.error) throw new Error(d.error);
          if (!cancelled) setData(d);
        } catch {
          if (!cancelled) setError('Could not load the growth dashboard just now.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [attempt]);

  if (error) return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
      <button
        onClick={() => { setData(null); setAttempt((a) => a + 1); }}
        className="ml-auto rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-bold transition hover:bg-destructive/20"
      >
        Try again
      </button>
    </div>
  );
  if (!data) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const attention = [
    data.entries.pending > 0 && { title: `${data.entries.pending} entr${data.entries.pending === 1 ? 'y' : 'ies'} awaiting moderation`, action: 'Review in the Challenge Engine' },
    data.campaigns.drafts > 0 && { title: `${data.campaigns.drafts} draft campaign${data.campaigns.drafts === 1 ? '' : 's'} not yet sent`, action: 'Open Campaigns', tab: 'campaigns' },
    data.pipeline.new > 0 && { title: `${data.pipeline.new} new outreach inquir${data.pipeline.new === 1 ? 'y' : 'ies'}`, action: 'Open Outreach', tab: 'outreach' },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Audience members" value={data.audience.total} detail={`${data.audience.unsubscribed} unsubscribed`} icon={Users} />
        <Stat label="Approved submissions" value={data.entries.approved} detail={`${data.entries.pending} pending moderation`} icon={Trophy} />
        <Stat label="Campaign emails delivered" value={data.campaigns.emails_delivered} detail={`${data.campaigns.sent} campaigns sent · ${data.campaigns.drafts} drafts`} icon={Mail} />
        <Stat label="Organisations & outreach" value={data.organisations} detail={`${data.pipeline.total} inquiries in the pipeline`} icon={Building2} />
      </div>

      <GrowthInsights />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_.9fr]">
        <section className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl grad-soft-bg text-primary"><BarChart3 className="h-6 w-6" /></div>
          <h2 className="mt-4 font-heading text-xl font-bold">Acquisition funnel</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Funnel analytics (impressions → landing visits → verified registrations → submissions) will appear here once
            tracked links and acquisition events start recording. Until then, the verified numbers above are the source of truth
            — no estimated or placeholder metrics are shown.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-extrabold uppercase tracking-widest text-primary">Needs attention</p>
          <div className="mt-4 space-y-3">
            {attention.map((a) => (
              <button
                key={a.title}
                onClick={() => a.tab && onGoTo?.(a.tab)}
                className="group w-full rounded-xl border border-border bg-secondary p-3 text-left transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{a.title}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-primary transition group-hover:translate-x-1" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{a.action}</p>
              </button>
            ))}
            {!attention.length && <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}