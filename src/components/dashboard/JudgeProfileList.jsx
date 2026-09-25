import { useEffect, useState } from 'react';
import { Loader2, Search, Gavel } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { STATUS_LABELS, STATUS_STYLES, wwccLabel } from '@/lib/judges';
import JudgeProfileEditor from '@/components/dashboard/JudgeProfileEditor';

export default function JudgeProfileList({ onReload }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.JudgeProfile.list('-created_date', 500);
      setItems(list || []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!(`${p.name} ${p.email} ${p.state}`.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, state…"
            className="w-64 rounded-xl border border-input bg-white/5 py-2 pl-9 pr-3 text-sm" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-input bg-white/5 px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">No judge profiles match.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {filtered.map((p) => (
            <button key={p.id} onClick={() => setEditing(p)}
              className="text-left rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-muted/40">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary"><Gavel className="h-4 w-4" /></span>
                  <div>
                    <p className="font-bold leading-tight">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </div>
                </div>
                <span className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[p.status]}`}>{STATUS_LABELS[p.status]}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {p.state && <span className="rounded-md bg-white/5 px-2 py-1">{p.state}</span>}
                <span className="rounded-md bg-white/5 px-2 py-1">WWCC: {wwccLabel(p)}</span>
                <span className="rounded-md bg-white/5 px-2 py-1">{(p.approved_categories || []).length} categories</span>
                <span className="rounded-md bg-white/5 px-2 py-1">{(p.conflict_of_interest || []).length} COI</span>
                {p.agreement_signed && <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-emerald-400">Agreement signed</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <JudgeProfileEditor profile={editing} onClose={() => setEditing(null)}
          onSaved={(updated) => { setEditing(updated); load(); onReload?.(); }} />
      )}
    </div>
  );
}