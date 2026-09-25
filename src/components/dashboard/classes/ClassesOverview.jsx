import { Calendar, Clock, GraduationCap, Megaphone, ArrowRight } from 'lucide-react';
import { classDetailsUrl } from '@/lib/siteConfig';

const BLUE = '#2e5bff';
const TEAL = '#0a8882';

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
  } catch { return d; }
}

/** Overview sub-tab: announcements, current enrolment, next booking, completed count. */
export default function ClassesOverview({ enrolled, running, nextBooking }) {
  const completed = enrolled.filter((c) => (c.status || '').toLowerCase() === 'completed').length;
  const current = enrolled.find((c) => (c.status || '').toLowerCase() === 'confirmed') || enrolled[0] || null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <Megaphone className="mt-0.5 h-5 w-5 shrink-0" style={{ color: BLUE }} />
        <div>
          <p className="text-sm font-bold text-slate-900">
            {running.length > 0
              ? `${running.length} class${running.length === 1 ? '' : 'es'} running right now`
              : 'No classes running right now'}
          </p>
          <p className="mt-0.5 text-sm text-slate-600">
            New classes are published regularly — check the Learning Path tab for what suits you next.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current enrolment</p>
          {current ? (
            <>
              <p className="mt-1 font-bold text-slate-900">{current.title}</p>
              <p className="mt-0.5 text-xs capitalize text-slate-500">{current.status || 'pending'}</p>
              <a
                href={classDetailsUrl(current.class_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold"
                style={{ color: BLUE }}
              >
                Open class <ArrowRight className="h-4 w-4" />
              </a>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-500">You're not enrolled in a class yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next booking</p>
          {nextBooking ? (
            <>
              <p className="mt-1 font-bold text-slate-900">{nextBooking.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {fmtDate(nextBooking.class_date)}</span>
                {nextBooking.class_time && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {nextBooking.class_time}</span>}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Nothing scheduled.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Classes completed</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-slate-900">
            <GraduationCap className="h-5 w-5" style={{ color: TEAL }} /> {completed}
          </p>
        </div>
      </div>
    </div>
  );
}