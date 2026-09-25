import { Search, X } from 'lucide-react';
import { DIVISIONS } from '@/lib/challenges-data';

export default function DiscoverToolbar({ search, setSearch, division, setDivision, state, setState, sort, setSort, states = [], onReset }) {
  const hasFilters = search || division || state;
  return (
    <div className="sticky top-[64px] z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="container-tight flex flex-wrap items-center gap-3 py-4">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search finalists…" className="c53-input pl-9" />
        </div>
        <select value={division} onChange={(e) => setDivision(e.target.value)} className="c53-input w-auto">
          <option value="">All divisions</option>
          {DIVISIONS.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
        </select>
        <select value={state} onChange={(e) => setState(e.target.value)} className="c53-input w-auto">
          <option value="">All states</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="c53-input w-auto">
          <option value="-community_votes">Most votes</option>
          <option value="-submitted_at">Newest</option>
        </select>
        {hasFilters && (
          <button onClick={onReset} className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Reset filters">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}