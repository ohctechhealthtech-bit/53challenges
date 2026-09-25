import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import LaunchCard from '@/components/launch/LaunchCard';
import ComingSoonCard from '@/components/launch/ComingSoonCard';

export default function ComingSoon() {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setItems(await base44.entities.LaunchCompetition.list('-created_date', 200) || []); }
      catch { setItems([]); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="container-tight py-24 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>;

  const live = (items || []).filter((i) => i.status === 'live');
  const soon = (items || []).filter((i) => i.status === 'coming_soon');
  const cats = [...new Set(soon.map((s) => s.category))];

  return (
    <div className="container-tight py-12">
      <h1 className="font-heading text-4xl font-extrabold">Competitions</h1>
      <p className="mt-2 text-muted-foreground">Four national competitions are live now. The rest of our subcategories are coming soon — register your interest and we'll notify you when entries open.</p>

      {live.length > 0 && (
        <section className="mt-8">
          <h2 className="font-heading text-xl font-bold">Live now</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">{live.map((i) => <LaunchCard key={i.id} item={i} />)}</div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-heading text-xl font-bold">Coming soon</h2>
        <p className="text-sm text-muted-foreground">Expression of interest for upcoming subcategories — we'll let you know when entries open.</p>
        <div className="mt-4 space-y-8">
          {cats.map((cat) => (
            <div key={cat}>
              <h3 className="font-heading text-lg font-bold">{cat}</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {soon.filter((s) => s.category === cat).map((i) => <ComingSoonCard key={i.id} item={i} />)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}