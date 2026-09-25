import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Handshake } from 'lucide-react';

const prettify = (s) => String(s || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export default function SJPanelLists() {
  const [data, setData] = useState(null);

  useEffect(() => {
    base44.functions.invoke('publicPanel', {})
      .then((r) => setData(r.data || { judges: [], sponsors: [] }))
      .catch(() => setData({ judges: [], sponsors: [] }));
  }, []);

  if (!data) {
    return (
      <section className="container-tight py-16">
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
      </section>
    );
  }

  return (
    <section className="container-tight space-y-14 py-16">
      <div>
        <h2 className="font-heading text-3xl font-extrabold sm:text-4xl">Meet our judges</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          The people scoring entries across our challenges.
        </p>
        {data.judges.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-border bg-card p-6 text-muted-foreground">
            Our judging panel for the next season is being confirmed — check back soon.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.judges.map((j) => (
              <div key={j.id} className="card-lift rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/15 font-heading text-sm font-extrabold text-primary">
                    {initials(j.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-heading text-lg font-bold">{j.name}</p>
                    {j.state && <p className="text-sm text-muted-foreground">{j.state}</p>}
                  </div>
                </div>
                {j.categories.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {j.categories.map((c) => (
                      <span key={c} className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {prettify(c)}
                      </span>
                    ))}
                  </div>
                )}
                {j.experience && <p className="mt-3 text-sm text-muted-foreground">{j.experience}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-heading text-3xl font-extrabold sm:text-4xl">Meet our sponsors</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          The brands and organisations backing prizes and opportunities.
        </p>
        {data.sponsors.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-border bg-card p-6 text-muted-foreground">
            We're welcoming our first sponsors now — your brand could be here.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.sponsors.map((s) => (
              <div key={s.id} className="card-lift flex items-center gap-3 rounded-2xl border border-border bg-card p-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
                  <Handshake className="h-5 w-5" />
                </span>
                <p className="truncate font-heading font-bold">{s.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}