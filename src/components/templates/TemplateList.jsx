import { Search } from 'lucide-react';
import TemplateStatusBadge from './TemplateStatusBadge';
import { SERVICE_TIERS, TEMPLATE_STATUSES, labelFor } from '@/lib/templateLibrary';

export default function TemplateList({ templates, filters, onFilters, selectedId, onSelect }) {
  const set = (k, v) => onFilters({ ...filters, [k]: v });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className="c53-input pl-9"
          placeholder="Search templates by name"
          aria-label="Search templates by name"
          value={filters.search || ''}
          onChange={(e) => set('search', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select className="c53-input" aria-label="Filter by status" value={filters.status || ''} onChange={(e) => set('status', e.target.value)}>
          <option value="">All statuses</option>
          {TEMPLATE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="c53-input" aria-label="Filter by service tier" value={filters.service_tier || ''} onChange={(e) => set('service_tier', e.target.value)}>
          <option value="">All tiers</option>
          {SERVICE_TIERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input
          className="c53-input"
          placeholder="Category"
          aria-label="Filter by category"
          value={filters.category || ''}
          onChange={(e) => set('category', e.target.value)}
        />
        <select className="c53-input" aria-label="Sort templates" value={filters.sort || 'modified'} onChange={(e) => set('sort', e.target.value)}>
          <option value="modified">Last modified</option>
          <option value="name">Name</option>
          <option value="version">Version</option>
        </select>
      </div>

      <button
        type="button"
        onClick={() => onFilters({ sort: 'modified' })}
        className="text-xs font-semibold text-primary hover:underline"
      >
        Clear filters
      </button>

      <ul className="space-y-2">
        {templates.length === 0 && (
          <li className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No templates match these filters.
          </li>
        )}
        {templates.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onSelect(t)}
              className={`w-full rounded-xl border p-3 text-left transition ${String(t.id) === String(selectedId) ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'}`}
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-sm font-bold">{t.template_name || 'Untitled template'}</span>
                <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">v{t.template_version}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <TemplateStatusBadge status={t.template_status} />
                <span>{labelFor(SERVICE_TIERS, t.service_tier)}</span>
                {t.primary_category_id && <span>· {t.primary_category_id}</span>}
                <span>· {new Date(t.updated_date || t.created_date).toLocaleDateString()}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}