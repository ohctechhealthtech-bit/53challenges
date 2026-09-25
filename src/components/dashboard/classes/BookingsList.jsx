import { Calendar, Clock, Wallet, ExternalLink, Info } from 'lucide-react';
import { classDetailsUrl } from '@/lib/siteConfig';

const STATUS_STYLES = {
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return d; }
}

/** Bookings sub-tab: every booking with its status, payment and class page link. */
export default function BookingsList({ enrolled }) {
  if (enrolled.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        You have no bookings yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-sm text-slate-600">
          Cancelling or rescheduling is handled on the class page, where the instructor's own policy applies.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {enrolled.map((c) => (
          <div
            key={c.booking_id || c.class_id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 last:border-0"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{c.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {fmtDate(c.class_date)}</span>
                {c.class_time && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {c.class_time}</span>}
                {c.total_price > 0 && <span className="inline-flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> ${c.total_price}</span>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">
                {c.payment_status || 'pending'}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[c.status] || STATUS_STYLES.pending}`}>
                {c.status || 'pending'}
              </span>
              <a
                href={classDetailsUrl(c.class_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Manage <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}