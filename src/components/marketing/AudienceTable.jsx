import { useEffect, useState } from 'react';
import { Loader2, Filter, Ban } from 'lucide-react';
import { listAudience, unsubscribeAudience, AUDIENCE_TYPES, CATEGORIES } from '@/lib/marketing';
import { STATES } from '@/lib/challenges-data';

export default function AudienceTable() {
  const [seg, setSeg] = useState({ audience_types: [], states: [], categories: [], participated_only: false });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setData(await listAudience(seg)); } catch { setData({ members: [], count: 0, total: 0 }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggle = (key, val) => setSeg((s) => ({ ...s, [key]: s[key].includes(val) ? s[key].filter((x) => x !== val) : [...s[key], val] }));
  const unsub = async (email) => { await unsubscribeAudience(email); load(); };

  return (
    <div className="space-y-5">
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold"><Filter className="h-4 w-4" /> Segment</div>
        <div className="mt-3 grid gap-4 md:grid-cols-4">
          <ChipGroup label="Audience type" options={AUDIENCE_TYPES} selected={seg.audience_types} onToggle={(v) => toggle('audience_types', v)} />
          <ChipGroup label="State" options={STATES.slice(0, 8)} selected={seg.states} onToggle={(v) => toggle('states', v)} />
          <ChipGroup label="Category interest" options={CATEGORIES.slice(0, 8)} selected={seg.categories} onToggle={(v) => toggle('categories', v)} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={seg.participated_only} onChange={(e) => setSeg((s) => ({ ...s, participated_only: e.target.checked }))} /> Past participants only</label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="rounded-xl grad-bg px-5 py-2 text-sm font-bold text-white">Apply segment</button>
          <span className="text-sm text-muted-foreground">{data ? `${data.count} of ${data.total} matched` : ''}</span>
        </div>
      </form>
      {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">State</th><th className="px-4 py-2">Interests</th><th className="px-4 py-2">Source</th><th className="px-4 py-2">Status</th><th className="px-4 py-2"></th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.members || []).map((m) => (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{m.name || '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground">{m.email}</td>
                  <td className="px-4 py-2">{m.audience_type}</td>
                  <td className="px-4 py-2">{m.state || '—'}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{(m.category_interests || []).join(', ')}</td>
                  <td className="px-4 py-2 text-xs">{m.source}</td>
                  <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${m.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{m.status}</span></td>
                  <td className="px-4 py-2">{m.status === 'active' && <button onClick={() => unsub(m.email)} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"><Ban className="h-3 w-3" /> Unsub</button>}</td>
                </tr>
              ))}
              {!(data?.members || []).length && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No audience members in this segment.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ChipGroup({ label, options, selected, onToggle }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button type="button" key={o} onClick={() => onToggle(o)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selected.includes(o) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{o}</button>
        ))}
      </div>
    </div>
  );
}