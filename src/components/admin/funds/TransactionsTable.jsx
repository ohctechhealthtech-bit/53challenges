import { label, money, SOURCE_LABELS, POOL_LABELS, when } from './fundsMeta';

export default function TransactionsTable({ transactions = [], count = 0 }) {
  return (
    <section className="mt-8">
      <h3 className="font-heading text-base font-bold">
        Money movements
        <span className="ml-2 text-sm font-normal text-muted-foreground">{count} in total</span>
      </h3>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Pool</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Who / what</th>
              <th className="px-4 py-3">Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-t border-border align-top">
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{when(t.timestamp)}</td>
                <td className="px-4 py-3 font-semibold">{label(SOURCE_LABELS, t.source)}</td>
                <td className="px-4 py-3 text-muted-foreground">{label(POOL_LABELS, t.pool)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${Number(t.amount) < 0 ? 'text-destructive' : ''}`}>
                  {money(t.amount)}
                  {t.split_percent ? <span className="block text-xs font-normal text-muted-foreground">{t.split_percent}% of {money(t.gross_amount)}</span> : null}
                </td>
                <td className="px-4 py-3">
                  {t.recipient || t.purpose ? <span className="block">{t.recipient || label({}, t.purpose)}</span> : null}
                  {t.note && <span className="block text-xs text-muted-foreground">{t.note}</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{t.created_by_email || '—'}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No money has moved yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}