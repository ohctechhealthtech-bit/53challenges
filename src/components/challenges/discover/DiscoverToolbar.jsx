import { Search, X, ArrowUpDown, SlidersHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DIVISIONS } from '@/lib/challenges-data';
import { SORT_OPTIONS, STATE_NAMES } from './discoverConstants';

// Sticky search-and-filter bar for Discover & Vote. Same prop contract the
// page has always used (division and state are this app's slugs and codes,
// sort ids are this app's own) with the look of the main site's toolbar:
// one search field, quick chips, a Filters popover, a Sort popover, and the
// active filters spelled out underneath with the result count.

const chipBase =
  'inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2';

function QuickChip({ active, onClick, children }) {
  const look = active
    ? 'bg-orange-500 text-white shadow-sm'
    : 'border border-stone-200 bg-white text-stone-700 hover:border-orange-300 hover:bg-orange-50';
  return (
    <button type="button" onClick={onClick} className={chipBase + ' ' + look}>
      {children}
    </button>
  );
}

function FilterGroup({ title, options, value, onChange }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const look = value === opt.id ? 'bg-orange-500 text-white' : 'bg-stone-100 text-stone-700 hover:bg-orange-100';
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={'rounded-full px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ' + look}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActiveChip({ onClear, children }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200"
    >
      {children} <X className="h-3 w-3" />
    </button>
  );
}

export default function DiscoverToolbar({
  search, setSearch,
  division, setDivision,
  state, setState,
  sort, setSort,
  states = [],
  onReset,
  resultCount = 0,
  loading = false,
}) {
  const hasFilters = !!search.trim() || !!division || !!state;
  const divisionOptions = [{ id: '', label: 'All Divisions' }, ...DIVISIONS.map((d) => ({ id: d.slug, label: d.name }))];
  const stateOptions = [{ id: '', label: 'All States' }, ...states.map((s) => ({ id: s, label: s }))];
  const divisionName = DIVISIONS.find((d) => d.slug === division)?.name;
  const sortLabel = SORT_OPTIONS.find((o) => o.id === sort)?.label || 'Sort';

  return (
    <div className="sticky top-[64px] z-20 border-b border-orange-100 bg-[#FDF8F1]/95 px-4 pb-3 pt-3 backdrop-blur-sm sm:px-8">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by participant, challenge, category, location..."
          aria-label="Search entries"
          className="h-12 w-full rounded-2xl border border-stone-200 bg-white pl-12 pr-10 text-base text-stone-900 shadow-sm transition-shadow placeholder:text-stone-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <QuickChip active={sort === '-community_votes'} onClick={() => setSort('-community_votes')}>Most Voted</QuickChip>
        <QuickChip active={sort === '-submitted_at'} onClick={() => setSort('-submitted_at')}>Newest</QuickChip>
        <QuickChip active={division === 'adults'} onClick={() => setDivision(division === 'adults' ? '' : 'adults')}>Adults</QuickChip>
        <QuickChip active={state === 'QLD'} onClick={() => setState(state === 'QLD' ? '' : 'QLD')}>Queensland</QuickChip>
        <QuickChip active={!division} onClick={() => setDivision('')}>All Divisions</QuickChip>

        <div className="ml-auto flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={chipBase + ' border border-stone-200 bg-white text-stone-700 hover:border-teal-300 hover:bg-teal-50'}>
                <SlidersHorizontal className="h-4 w-4 text-teal-600" />
                Filters
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-4 rounded-2xl border-stone-200 bg-white p-4 shadow-lg">
              <FilterGroup title="Division" options={divisionOptions} value={division} onChange={setDivision} />
              <FilterGroup title="State" options={stateOptions} value={state} onChange={setState} />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={chipBase + ' bg-teal-600 text-white shadow-sm hover:bg-teal-700'}>
                <ArrowUpDown className="h-4 w-4" />
                {sortLabel}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 rounded-2xl border-stone-200 bg-white p-2 shadow-lg">
              {SORT_OPTIONS.map((opt) => {
                const look = sort === opt.id ? 'bg-orange-500 text-white' : 'text-stone-700 hover:bg-orange-50';
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSort(opt.id)}
                    className={'w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ' + look}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="mt-2.5 flex min-h-[24px] flex-wrap items-center gap-2">
        {!loading && (
          <span className="text-sm font-semibold text-stone-600">
            {resultCount} {resultCount === 1 ? 'entry' : 'entries'}
            {search.trim() && <span className="font-normal text-stone-500"> for &ldquo;{search.trim()}&rdquo;</span>}
          </span>
        )}
        {division && <ActiveChip onClear={() => setDivision('')}>{divisionName || division}</ActiveChip>}
        {state && <ActiveChip onClear={() => setState('')}>{STATE_NAMES[state] || state}</ActiveChip>}
        {hasFilters && (
          <button type="button" onClick={onReset} className="text-xs font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-900">
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}
