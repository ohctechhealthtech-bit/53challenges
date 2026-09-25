export default function IdeaAnswersTable({ answers = [] }) {
  if (!answers.length) return null;

  const groups = answers.reduce((acc, a) => {
    const key = a.group || 'Details';
    (acc[key] = acc[key] || []).push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <p className="text-sm font-bold text-stone-900">Full submitted details</p>
      {Object.entries(groups).map(([group, rows]) => (
        <div key={group} className="border border-stone-200 rounded-lg overflow-hidden">
          <p className="bg-stone-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-stone-600">{group}</p>
          <div className="divide-y divide-stone-100">
            {rows.map((row, i) => (
              <div key={`${row.label}-${i}`} className="grid sm:grid-cols-3 gap-1 px-4 py-2.5">
                <p className="text-xs font-semibold text-stone-500">{row.label || row.question || `Field ${i + 1}`}</p>
                <p className="sm:col-span-2 text-sm text-stone-900 whitespace-pre-wrap">
                  {Array.isArray(row.value) ? row.value.join(', ') : (row.value ?? row.answer ?? '—')}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}