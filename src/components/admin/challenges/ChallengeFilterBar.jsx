import { Search } from 'lucide-react';
import { SORTS, statusLabel, titleCase } from './challengeMeta';

// Status / stage / season / search / sort controls for the challenge list.
export default function ChallengeFilterBar({ filters, reference, search, onSearch, onChange, onSubmitSearch }) {
  const statuses = reference?.statuses || [];
  const stages = reference?.pipeline_stages || [];
  const seasons = reference?.seasons || [];

  return (
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <Field label="Status" id="cf-status">
        <select id="cf-status" className="c53-input w-40" value={filters.status} onChange={(e) => onChange('status', e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </Field>

      <Field label="Stage" id="cf-stage">
        <select id="cf-stage" className="c53-input w-40" value={filters.stage} onChange={(e) => onChange('stage', e.target.value)}>
          <option value="">All stages</option>
          {stages.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
      </Field>

      <Field label="Season" id="cf-season">
        {seasons.length ? (
          <select id="cf-season" className="c53-input w-32" value={filters.season} onChange={(e) => onChange('season', e.target.value)}>
            <option value="">All seasons</option>
            {seasons.map((s) => <option key={s.season || s} value={s.season || s}>{s.season || s}</option>)}
          </select>
        ) : (
          <input id="cf-season" className="c53-input w-32" placeholder="e.g. 2026" value={filters.season} onChange={(e) => onChange('season', e.target.value)} />
        )}
      </Field>

      <Field label="Sort by" id="cf-sort">
        <select id="cf-sort" className="c53-input w-44" value={filters.sort} onChange={(e) => onChange('sort', e.target.value)}>
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </Field>

      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); onSubmitSearch(); }}>
        <Field label="Search" id="cf-search">
          <input id="cf-search" className="c53-input w-52" placeholder="Title or theme" value={search} onChange={(e) => onSearch(e.target.value)} />
        </Field>
        <button type="submit" className="rounded-lg bg-muted p-2.5 text-muted-foreground hover:text-foreground" aria-label="Search challenges">
          <Search className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function Field({ label, id, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}