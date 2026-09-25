import { DETAIL_ROWS } from './statsMeta';

export default function StatsDetailTable({ counts = {} }) {
  const rows = DETAIL_ROWS.filter((r) => counts[r.key] != null);
  if (rows.length === 0) return null;

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-muted-foreground">{r.label}</td>
              <td className="px-4 py-3 text-right font-semibold">{r.format(counts[r.key])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}