const TEAL = '#0a8882';

/** Progress sub-tab: completion across every enrolled class. */
export default function ClassProgress({ enrolled }) {
  if (enrolled.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        Enrol in a class to start tracking progress.
      </div>
    );
  }

  const completedCount = enrolled.filter((c) => (c.status || '').toLowerCase() === 'completed').length;
  const overall = Math.round((completedCount / enrolled.length) * 100);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between">
          <p className="text-sm font-bold text-slate-900">Overall</p>
          <p className="text-sm text-slate-500">{completedCount} of {enrolled.length} classes completed</p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full" style={{ width: `${overall}%`, backgroundColor: TEAL }} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {enrolled.map((c) => {
          const explicit = c.progress ?? c.completion_percent;
          const pct = typeof explicit === 'number'
            ? explicit
            : (c.status || '').toLowerCase() === 'completed' ? 100 : 0;
          return (
            <div key={c.booking_id || c.class_id} className="border-b border-slate-100 px-5 py-4 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{c.title}</p>
                <p className="text-xs font-semibold text-slate-500">
                  {typeof explicit === 'number' ? `${pct}% complete` : (c.status || 'pending')}
                </p>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: TEAL }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}