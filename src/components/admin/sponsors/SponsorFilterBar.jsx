import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { titleCase } from './sponsorsMeta';

export default function SponsorFilterBar({ filters, tiers = [], onChange, onSearch, searchInput, onSearchInput }) {
  return (
    <div className="mt-5 flex flex-wrap items-end gap-3">
      <div className="min-w-[170px]">
        <label htmlFor="sp-tier" className="mb-1.5 block text-sm font-semibold">Tier</label>
        <select id="sp-tier" className="c53-input" value={filters.tier} onChange={(e) => onChange('tier', e.target.value)}>
          <option value="">All tiers</option>
          {tiers.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
        </select>
      </div>
      <div className="min-w-[170px]">
        <label htmlFor="sp-active" className="mb-1.5 block text-sm font-semibold">Visibility</label>
        <select id="sp-active" className="c53-input" value={filters.active} onChange={(e) => onChange('active', e.target.value)}>
          <option value="">Everyone</option>
          <option value="true">Showing publicly</option>
          <option value="false">Hidden</option>
        </select>
      </div>
      <div className="min-w-[150px]">
        <label htmlFor="sp-season" className="mb-1.5 block text-sm font-semibold">Season</label>
        <input id="sp-season" className="c53-input" placeholder="Any" value={filters.season} onChange={(e) => onChange('season', e.target.value)} />
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); onSearch(); }}
        className="flex min-w-[260px] flex-1 items-end gap-2"
      >
        <div className="flex-1">
          <label htmlFor="sp-search" className="mb-1.5 block text-sm font-semibold">Search</label>
          <input id="sp-search" className="c53-input" placeholder="Sponsor or contact name" value={searchInput} onChange={(e) => onSearchInput(e.target.value)} />
        </div>
        <Button type="submit" variant="outline"><Search className="h-4 w-4" /> Search</Button>
      </form>
    </div>
  );
}