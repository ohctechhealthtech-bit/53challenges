import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, BellRing, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import ChallengeCard from '@/components/challenges/ChallengeCard';
import { challengePhase, daysLeft } from '@/lib/challenges-data';
import RevealOnScroll from '@/components/home/RevealOnScroll';

const TABS = [
  { key: 'open', label: 'Open Now' },
  { key: 'soon', label: 'Coming Soon' },
  { key: 'vote', label: 'Voting Now' },
  { key: 'done', label: 'Completed' },
];

const SORTS = [
  { key: 'closing', label: 'Closing Soon' },
  { key: 'recent', label: 'Recently Added' },
  { key: 'popular', label: 'Most Popular' },
  { key: 'entries', label: 'Most Entries' },
];

function phaseKey(ch) {
  const p = challengePhase(ch);
  if (p === 'submit') return 'open';
  if (p === 'upcoming') return 'soon';
  if (p === 'vote') return 'vote';
  return 'done';
}

export default function CategoryChallenges({ challenges = [], accent }) {
  const buckets = useMemo(() => {
    const b = { open: [], soon: [], vote: [], done: [] };
    challenges.forEach((c) => b[phaseKey(c)].push(c));
    return b;
  }, [challenges]);

  const firstNonEmpty = TABS.find((t) => buckets[t.key].length > 0)?.key || 'open';
  const [tab, setTab] = useState(firstNonEmpty);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('closing');
  const [freeOnly, setFreeOnly] = useState(false);

  const list = useMemo(() => {
    let arr = [...(buckets[tab] || [])];
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter((c) => (c.theme || c.title || '').toLowerCase().includes(q) || (c.brief || '').toLowerCase().includes(q));
    }
    if (freeOnly) arr = arr.filter((c) => !c.entry_fee || c.entry_fee === 0);
    arr.sort((a, b) => {
      if (sort === 'closing') return daysLeft(a.submission_ends_at || a.voting_ends_at) - daysLeft(b.submission_ends_at || b.voting_ends_at);
      if (sort === 'recent') return new Date(b.created_at || b.starts_at || 0) - new Date(a.created_at || a.starts_at || 0);
      if (sort === 'popular') return (b.total_votes || 0) - (a.total_votes || 0);
      if (sort === 'entries') return (b.total_entries || 0) - (a.total_entries || 0);
      return 0;
    });
    return arr;
  }, [buckets, tab, query, sort, freeOnly]);

  const activeTab = buckets[tab]?.length > 0 ? tab : firstNonEmpty;

  return (
    <section id="challenges" className="scroll-mt-24 border-t border-border">
      <div className="container-tight py-14">
        <RevealOnScroll className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: accent }}>Challenges</p>
          <h2 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">Challenges in this category</h2>
          <p className="mt-2 text-sm text-muted-foreground">Explore current and upcoming opportunities, submit your work and showcase what you can do.</p>
        </RevealOnScroll>

        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((t) => {
            const n = buckets[t.key]?.length || 0;
            const on = activeTab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} disabled={n === 0}
                className="rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-40"
                style={on ? { backgroundColor: accent, color: '#fff' } : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}>
                {t.label} ({n})
              </button>
            );
          })}
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search challenges…"
              className="c53-input pl-9" />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} className="accent-[var(--ring)]" /> Free entry
            </label>
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-input bg-card px-3 py-2 text-sm">
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {list.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => <ChallengeCard key={c.id} challenge={c} entryCount={c.total_entries || 0} />)}
          </div>
        ) : (
          <EmptyState accent={accent} hasCompleted={buckets.done.length > 0} />
        )}
      </div>
    </section>
  );
}

function EmptyState({ accent, hasCompleted }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-10 text-center">
      <BellRing className="mx-auto h-10 w-10" style={{ color: accent }} />
      <h3 className="mt-4 font-heading text-xl font-bold">No challenges are currently open in this category.</h3>
      <p className="mt-2 text-sm text-muted-foreground">Join the notification list and we'll let you know when a new challenge becomes available.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/coming-soon" className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ backgroundColor: accent }}>
          <BellRing className="h-4 w-4" /> Notify Me
        </Link>
        <Link to="/challenges" className="inline-flex items-center gap-2 rounded-xl border border-border bg-white/5 px-5 py-2.5 text-sm font-bold">
          <Compass className="h-4 w-4" /> Explore Other Categories
        </Link>
      </div>
      {hasCompleted && <p className="mt-4 text-xs text-muted-foreground">Completed challenges appear under the Completed tab.</p>}
    </div>
  );
}