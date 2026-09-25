import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { challengeApi } from '@/lib/challengeApi';
import { matchChallengeSearch } from '@/lib/taxonomy';
import ChallengeCard from '@/components/challenges/ChallengeCard';
import ActiveChallengeBanner from '@/components/challenges/ActiveChallengeBanner';
import CategoryGrid from '@/components/challenges/CategoryGrid';
import { CardSkeleton } from '@/components/motion/Skeleton';
import { categoryMeta, challengePhase, normalizeCategory } from '@/lib/challenges-data';
import { useCategories } from '@/hooks/useCategories';
import RevealOnScroll from '@/components/home/RevealOnScroll';
import { DURATION, EASE } from '@/lib/motion';

const PHASES = [
  { id: 'all', label: 'All' },
  { id: 'submit', label: 'Open for entries' },
  { id: 'vote', label: 'Voting now' },
  { id: 'upcoming', label: 'Coming soon' },
];

export default function Challenges() {
  const [params, setParams] = useSearchParams();
  const rawCat = params.get('category');
  const activeCat = rawCat ? normalizeCategory(rawCat) : 'all';
  const phase = params.get('phase') || 'all';
  const state = params.get('state') || '';
  const { categories } = useCategories();
  const [challenges, setChallenges] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true); setError('');
      try {
        const { challenges: chs } = await challengeApi.listChallenges({ status: 'active', limit: 200 });
        // Normalize every category through the canonical six so pills + filter agree.
        setChallenges((chs || []).map((c) => ({ ...c, category: normalizeCategory(c.category) })));
      } catch (e) {
        setError(e?.message || 'Could not load challenges.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const catCounts = useMemo(() => {
    const m = {};
    for (const ch of challenges) m[ch.category] = (m[ch.category] || 0) + 1;
    return m;
  }, [challenges]);

  const presentCats = useMemo(() => {
    const seen = Object.keys(catCounts);
    return seen.map((slug) => ({ slug, ...categoryMeta(slug) })).sort((a, b) => (catCounts[b.slug] || 0) - (catCounts[a.slug] || 0));
  }, [catCounts, categories]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return challenges.filter((c) => {
      if (activeCat && activeCat !== 'all' && c.category !== activeCat) return false;
      if (state && (c.state || '').toUpperCase() !== state.toUpperCase()) return false;
      if (phase !== 'all') {
        const p = challengePhase(c);
        if (phase === 'submit' && p !== 'submit') return false;
        // Open-for-entries challenges also accept votes, so they show under "Voting now".
        if (phase === 'vote' && p !== 'vote' && p !== 'submit') return false;
        if (phase === 'upcoming' && p !== 'upcoming') return false;
      }
      // niche_tags participates in search/discovery ONLY (Prompt 14).
      if (q && !matchChallengeSearch(c, q)) return false;
      return true;
    });
  }, [challenges, activeCat, phase, state, search]);

  const setCat = (slug) => {
    const next = new URLSearchParams(params);
    if (!slug || slug === 'all') next.delete('category'); else next.set('category', slug);
    setParams(next);
  };
  const setPhase = (id) => {
    const next = new URLSearchParams(params);
    if (id === 'all') next.delete('phase'); else next.set('phase', id);
    setParams(next);
  };
  const clearState = () => {
    const next = new URLSearchParams(params);
    next.delete('state');
    setParams(next);
  };

  return (
    <>
      <ActiveChallengeBanner />
      <div className="container-tight py-12">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">53 Challenges</p>
          <h1 className="mt-2 font-heading text-4xl font-extrabold sm:text-5xl">Choose your challenge</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Pick a category, find a theme that moves you, and enter your original work.</p>
        </div>

        {error && <p className="mt-8 rounded-xl bg-destructive/10 px-4 py-3 text-center text-sm font-medium text-destructive" role="alert">{error}</p>}

        {/* Search — matches title/theme/brief/category + niche_tags (Prompt 14) */}
        <div className="mt-10 flex justify-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search challenges, themes or tags…"
              className="c53-input pl-9 pr-9"
              aria-label="Search challenges"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Phase filter */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {PHASES.map((p) => (
            <button key={p.id} onClick={() => setPhase(p.id)}
              className={`relative rounded-full px-5 py-2 text-sm font-semibold transition-colors ${phase === p.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-secondary'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Active state filter chip */}
        {state && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={clearState}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/20"
            >
              <X className="h-3.5 w-3.5" /> State: {state}
            </button>
          </div>
        )}

        {/* Category filter pills */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button onClick={() => setCat('all')}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${activeCat === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-secondary'}`}>
            All ({challenges.length})
          </button>
          {presentCats.map((c) => (
            <button key={c.slug} onClick={() => setCat(c.slug)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${activeCat === c.slug ? 'text-white' : 'bg-muted text-foreground hover:bg-secondary'}`}
              style={activeCat === c.slug ? { backgroundColor: c.color } : {}}>
              {c.icon} {c.name} ({catCounts[c.slug] || 0})
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DURATION.fast }}
              className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
            </motion.div>
          ) : filtered.length ? (
            <motion.div
              key={`grid-${activeCat}-${phase}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.base, ease: EASE.out }}
              className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filtered.map((ch, i) => (
                <ChallengeCard key={ch.id || `ch-${i}`} challenge={ch} entryCount={ch.submission_count || 0} />
              ))}
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.base, ease: EASE.out }}
              className="mt-16 text-center text-muted-foreground">
              No challenges match these filters.
            </motion.div>
          )}
        </AnimatePresence>

        {activeCat === 'all' && phase === 'all' && !loading && presentCats.length > 0 && (
          <RevealOnScroll className="mt-20">
            <h2 className="mb-6 text-center font-heading text-2xl font-bold">Browse by category</h2>
            <CategoryGrid counts={catCounts} />
          </RevealOnScroll>
        )}
      </div>
    </>
  );
}