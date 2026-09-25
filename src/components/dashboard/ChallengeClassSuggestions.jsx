import { useEffect, useMemo, useState } from 'react';
import { Sparkles, ArrowUpRight, Clock, MapPin, GraduationCap, Loader2 } from 'lucide-react';
import { challengeApi } from '@/lib/challengeApi';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1499209974431-9ece4f496a52?auto=format&fit=crop&w=600&q=80';
const CLASSES_DOMAIN = 'https://53classes.com';

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Keywords extracted from an entry's category + challenge title, used to
// fuzzy-match against a class's title / category / short_description.
function entryKeywords(entry) {
  const parts = [
    entry?.category,
    entry?.challenge_title,
    entry?.title,
    entry?.challenge_id,
  ]
    .filter(Boolean)
    .flatMap((p) => String(p).split(/[\s\-_,&/]+/))
    .map((s) => s.toLowerCase().trim())
    .filter((s) => s && s.length > 2 && !['the', 'and', 'for', 'with', 'challenge', 'round', 'state', '2025', '2026'].includes(s));
  return [...new Set(parts)];
}

function classKeywords(cls) {
  const parts = [cls?.category, cls?.title, cls?.short_description, cls?.subcategory]
    .filter(Boolean)
    .flatMap((p) => String(p).split(/[\s\-_,&/]+/))
    .map((s) => s.toLowerCase().trim())
    .filter(Boolean);
  return new Set(parts);
}

function matchScore(entryCats, entryKws, cls) {
  const clsCat = slugify(cls?.category);
  let score = 0;

  // Direct category slug match (strongest signal)
  if (entryCats.has(clsCat)) score += 10;

  // Keyword overlap between entry and class metadata
  const clsKws = classKeywords(cls);
  for (const k of entryKws) {
    if (clsKws.has(k)) score += 3;
  }
  return score;
}

export default function ChallengeClassSuggestions({ entries }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    challengeApi
      .listClasses(100)
      .then((r) => mounted && setClasses(r || []))
      .catch(() => mounted && setClasses([]))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  // Derive the set of categories the user is actively competing in.
  const { entryCats, entryKws } = useMemo(() => {
    const cats = new Set();
    const kws = new Set();
    for (const e of entries || []) {
      const cat = slugify(e?.category);
      if (cat) cats.add(cat);
      for (const k of entryKeywords(e)) kws.add(k);
    }
    return { entryCats: cats, entryKws: kws };
  }, [entries]);

  // Rank running classes by relevance to the user's challenge categories.
  const ranked = useMemo(() => {
    if (!classes.length) return { matched: [], other: [] };
    if (!entryCats.size && !entryKws.size) {
      return { matched: [], other: classes.slice(0, 3) };
    }
    const scored = classes
      .map((c) => ({ c, score: matchScore(entryCats, entryKws, c) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    const matched = scored.slice(0, 3).map((x) => x.c);
    const other = matched.length < 3 ? classes.filter((c) => !matched.includes(c)).slice(0, 3 - matched.length) : [];
    return { matched, other };
  }, [classes, entryCats, entryKws]);

  if (loading) {
    return (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Finding classes for you…
        </div>
      </section>
    );
  }

  const showCards = ranked.matched.length > 0 ? ranked.matched : ranked.other;
  const hasMatches = ranked.matched.length > 0;

  if (showCards.length === 0) {
    // Still promote the domain even with no class data.
    return (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="h-5 w-5" /> Sharpen your skills with 53 Classes
            </h2>
            <p className="mt-1 text-sm text-white/80">
              Take your challenge talent further — browse live classes from expert coaches.
            </p>
          </div>
          <a
            href={CLASSES_DOMAIN}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-bold text-indigo-700 transition hover:-translate-y-0.5"
          >
            Explore 53classes.com <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Promotional header */}
      <div className="relative bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="h-5 w-5" /> Level up with 53 Classes
            </h2>
            <p className="mt-1 text-sm text-white/85">
              {hasMatches
                ? 'Based on your challenge entries — classes to sharpen the skills you are competing in.'
                : 'Take your challenge talent further — browse live classes from expert coaches.'}
            </p>
          </div>
          <a
            href={CLASSES_DOMAIN}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3.5 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-white/25"
          >
            Browse all <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Class cards */}
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {showCards.map((c) => {
          const href = c.id ? `${CLASSES_DOMAIN}/classes/${c.id}` : CLASSES_DOMAIN;
          return (
            <a
              key={c.id || c.title}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md"
            >
              <div className="relative h-32 overflow-hidden">
                <img
                  src={c.image || FALLBACK_IMG}
                  alt={c.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700">
                  {c.category ? String(c.category).replace(/_/g, ' ') : 'Class'}
                </span>
                <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: c.is_free ? '#00897b' : '#2962ff' }}>
                  {c.is_free ? 'FREE' : c.price ? `$${c.price}` : '—'}
                </span>
                <ArrowUpRight className="absolute bottom-3 right-3 h-5 w-5 text-white opacity-90 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="line-clamp-1 font-bold text-slate-900">{c.title}</h3>
                {c.short_description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{c.short_description}</p>}
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-slate-500">
                  {c.duration_minutes > 0 && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {c.duration_minutes}m</span>}
                  {c.skill_level && <span className="inline-flex items-center gap-1 capitalize"><GraduationCap className="h-3.5 w-3.5" /> {c.skill_level}</span>}
                  {(c.city || c.state) && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {[c.city, c.state].filter(Boolean).join(', ')}</span>}
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-indigo-600">
                  Explore on 53classes.com <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}