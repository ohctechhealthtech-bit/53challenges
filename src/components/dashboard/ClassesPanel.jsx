import { useEffect, useState } from 'react';
import { Loader2, Calendar, Clock, MapPin, User, GraduationCap, Wallet, ChevronRight, BookOpen, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { challengeApi } from '@/lib/challengeApi';
import { classDetailsUrl } from '@/lib/siteConfig';
import ClassThumb from '@/components/dashboard/ClassThumb';

const BLUE = '#2e5bff';
const TEAL = '#0a8882';

const STATUS_STYLES = {
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};
const PAY_STYLES = {
  paid: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  refunded: 'bg-slate-100 text-slate-600',
  free: 'bg-teal-50 text-teal-700',
};

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

/**
 * Classes tab. Accepts pre-fetched enrolled/running lists from the parent
 * (avoids a duplicate fetch on the dashboard); falls back to fetching its
 * own data when used standalone.
 * Enrolling / continuing a class deep-links to the external 53 Classes
 * details page (https://53classes.com/ClassDetails?id=...).
 */
export default function ClassesPanel({ enrolled: enrolledProp, running: runningProp, loading: loadingProp }) {
  const { user } = useAuth();
  const hasProps = enrolledProp !== undefined || runningProp !== undefined;

  const [localEnrolled, setLocalEnrolled] = useState([]);
  const [localRunning, setLocalRunning] = useState([]);
  const [localLoading, setLocalLoading] = useState(!hasProps);

  useEffect(() => {
    if (hasProps) return;
    let mounted = true;
    (async () => {
      setLocalLoading(true);
      try {
        const [r, m] = await Promise.all([
          challengeApi.listClasses(100).catch(() => []),
          user?.email ? challengeApi.myClasses(user.email).catch(() => []) : Promise.resolve([]),
        ]);
        if (!mounted) return;
        setLocalRunning(r);
        setLocalEnrolled(m);
      } finally {
        if (mounted) setLocalLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [hasProps, user?.email]);

  const enrolled = hasProps ? (enrolledProp || []) : localEnrolled;
  const running = hasProps ? (runningProp || []) : localRunning;
  const loading = hasProps ? (loadingProp ?? false) : localLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const nextEnrolled = [...enrolled]
    .filter((c) => c.class_date)
    .sort((a, b) => new Date(a.class_date) - new Date(b.class_date))
    .find((c) => new Date(`${c.class_date}T${c.class_time || '00:00'}`) >= new Date());

  return (
    <div className="space-y-8">
      {/* Continue learning — my enrolled classes */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <BookOpen className="h-5 w-5" style={{ color: BLUE }} /> Continue learning
        </h2>
        <p className="mt-1 text-sm text-slate-500">Your booked classes and what's up next.</p>

        {nextEnrolled ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: BLUE }}>Up next</p>
                <h3 className="mt-1 text-base font-bold text-slate-900">{nextEnrolled.title}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {fmtDate(nextEnrolled.class_date)}</span>
                  {nextEnrolled.class_time && <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> {nextEnrolled.class_time}</span>}
                  {nextEnrolled.number_of_spots > 0 && <span className="inline-flex items-center gap-1.5"><User className="h-4 w-4" /> {nextEnrolled.number_of_spots} spot{nextEnrolled.number_of_spots === 1 ? '' : 's'}</span>}
                </div>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[nextEnrolled.status] || STATUS_STYLES.pending}`}>
                {nextEnrolled.status || 'pending'}
              </span>
            </div>
            <a
              href={classDetailsUrl(nextEnrolled.class_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: BLUE }}
            >
              Continue class <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No upcoming classes booked. Browse running classes below to join one.
          </div>
        )}

        {enrolled.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {enrolled.map((c) => (
              <a
                key={c.booking_id || c.class_id}
                href={classDetailsUrl(c.class_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 transition hover:bg-slate-50 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{c.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {fmtDate(c.class_date)}</span>
                    {c.class_time && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {c.class_time}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {c.is_free || c.total_price === 0 ? (
                    <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">Free</span>
                  ) : c.total_price ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"><Wallet className="h-3.5 w-3.5" /> ${c.total_price}</span>
                  ) : null}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${PAY_STYLES[c.payment_status] || PAY_STYLES.pending}`}>
                    {c.payment_status || 'pending'}
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[c.status] || STATUS_STYLES.pending}`}>
                    {c.status || 'pending'}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Running classes */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <GraduationCap className="h-5 w-5" style={{ color: TEAL }} /> Running classes
        </h2>
        <p className="mt-1 text-sm text-slate-500">Live classes you can join right now.</p>

        {running.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            No running classes available right now — check back soon.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {running.map((c) => (
              <div key={c.id} className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="relative h-36 overflow-hidden">
                  <ClassThumb src={c.image} alt={c.title} className="h-full w-full rounded-none transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700">
                    {c.category ? String(c.category).replace(/_/g, ' ') : 'Class'}
                  </span>
                  <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: c.is_free ? TEAL : BLUE }}>
                    {c.is_free ? 'FREE' : c.price ? `$${c.price}` : '—'}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="line-clamp-1 font-bold text-slate-900">{c.title}</h3>
                  {c.short_description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{c.short_description}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {c.duration_minutes > 0 && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {c.duration_minutes} min</span>}
                    {c.skill_level && <span className="inline-flex items-center gap-1 capitalize"><GraduationCap className="h-3.5 w-3.5" /> {c.skill_level}</span>}
                    {c.location_type && <span className="inline-flex items-center gap-1 capitalize"><MapPin className="h-3.5 w-3.5" /> {c.location_type.replace(/_/g, ' ')}</span>}
                  </div>
                  {(c.city || c.state || c.host_name) && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      {(c.city || c.state) && <span>{[c.city, c.state].filter(Boolean).join(', ')}</span>}
                      {c.host_name && <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> {c.host_name}</span>}
                    </div>
                  )}
                  <a
                    href={classDetailsUrl(c.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white"
                    style={{ backgroundColor: c.is_free ? TEAL : BLUE }}
                  >
                    {c.is_free ? 'Join free class' : 'Enroll now'} <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}