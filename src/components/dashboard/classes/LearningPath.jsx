import { ArrowRight, Clock, GraduationCap } from 'lucide-react';
import { classDetailsUrl } from '@/lib/siteConfig';

const BLUE = '#2e5bff';
const LEVEL_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

/**
 * Learning Path sub-tab. Builds a suggested sequence from the running classes,
 * favouring the categories the student already engages with (their booked
 * classes and challenge entries), then ordering by skill level.
 */
export default function LearningPath({ enrolled, running, entries }) {
  const bookedIds = new Set(enrolled.map((c) => String(c.class_id)));
  const interests = new Set(
    [...enrolled.map((c) => c.category), ...entries.map((e) => e.category)]
      .filter(Boolean)
      .map((c) => String(c).toLowerCase().replace(/[-\s]/g, '_'))
  );

  const path = running
    .filter((c) => !bookedIds.has(String(c.id)))
    .map((c) => ({
      ...c,
      _match: interests.has(String(c.category || '').toLowerCase().replace(/[-\s]/g, '_')) ? 0 : 1,
      _level: LEVEL_ORDER[String(c.skill_level || '').toLowerCase()] ?? 1,
    }))
    .sort((a, b) => a._match - b._match || a._level - b._level)
    .slice(0, 6);

  if (path.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        No classes available to build a path from yet — check back once new classes are published.
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-500">
        {interests.size > 0
          ? 'Built around the categories you already work in, easiest first.'
          : 'A suggested starting sequence, easiest first.'}
      </p>
      <ol className="mt-4 space-y-3">
        {path.map((c, i) => (
          <li key={c.id} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white"
              style={{ backgroundColor: c._match === 0 ? BLUE : '#94a3b8' }}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-slate-900">{c.title}</p>
                {c._match === 0 && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                    Matches your work
                  </span>
                )}
              </div>
              {c.short_description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{c.short_description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                {c.skill_level && <span className="inline-flex items-center gap-1 capitalize"><GraduationCap className="h-3.5 w-3.5" /> {c.skill_level}</span>}
                {c.duration_minutes > 0 && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {c.duration_minutes} min</span>}
              </div>
            </div>
            <a
              href={classDetailsUrl(c.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="self-center inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: BLUE }}
            >
              Start <ArrowRight className="h-4 w-4" />
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}