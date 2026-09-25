import { useCallback, useEffect, useState } from 'react';
import { Lock, AlertTriangle } from 'lucide-react';
import SectionToolbar from '@/components/admin/SectionToolbar';
import FundsBalances from '@/components/admin/funds/FundsBalances';
import EntryFeePanel from '@/components/admin/funds/EntryFeePanel';
import SplitPanel from '@/components/admin/funds/SplitPanel';
import ContributionForm from '@/components/admin/funds/ContributionForm';
import DisbursementForm from '@/components/admin/funds/DisbursementForm';
import RefundQueue from '@/components/admin/funds/RefundQueue';
import TransactionsTable from '@/components/admin/funds/TransactionsTable';
import ReportPanel from '@/components/admin/funds/ReportPanel';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

export default function FundsTab({ challengeId, actingEmail }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!challengeId) { setData(null); return; }
    setLoading(true);
    setError('');
    try {
      setData(await adminChallengeApi.funds({ challengeId, actingEmail }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [challengeId, actingEmail]);

  useEffect(() => { load(); }, [load]);

  // Every write goes through here so the acting admin is always attributed and
  // the tab refreshes with the new balances.
  const run = async (operation, params, message) => {
    const res = await adminChallengeApi.fundsUpdate(operation, { ...params, actingEmail });
    setNote(message);
    await load();
    return res;
  };

  const readOnly = Boolean(data?.season_archived);

  if (!challengeId) {
    return (
      <>
        <SectionToolbar section="funds" title="Funds" description="Entry fees, sponsor money, prize payments and refunds." />
        <p className="mt-6 text-sm text-muted-foreground">Choose a challenge to see its money.</p>
      </>
    );
  }

  return (
    <>
      <SectionToolbar
        section="funds"
        title="Funds"
        description="Entry fees, sponsor money, prize payments and refunds."
        challengeId={challengeId}
      />

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {note && <p className="mt-4 text-sm text-success">{note}</p>}

      {loading && !data && <p className="mt-6 text-sm text-muted-foreground">Loading the money for this challenge…</p>}

      {data && (
        <>
          {readOnly && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <span>{data.season_read_only_reason || 'This season is closed, so its money can only be viewed.'}</span>
            </p>
          )}
          {data.no_season_warning && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>{data.no_season_warning}</span>
            </p>
          )}
          {data.season && (
            <p className="mt-4 text-sm text-muted-foreground">Season <span className="font-semibold text-foreground">{data.season}</span></p>
          )}

          <FundsBalances balances={data.balances} totals={data.totals} />

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <EntryFeePanel
              entryFee={data.entry_fee}
              challengeId={challengeId}
              readOnly={readOnly}
              onSave={(p) => run('set_entry_fee', p, 'Entry fee saved.')}
            />
            <SplitPanel
              split={data.split}
              season={data.season}
              readOnly={readOnly}
              onSave={(p) => run('update_split', p, 'Entry fee share saved.')}
            />
            <ContributionForm
              season={data.season}
              readOnly={readOnly}
              onSave={(p) => run('add_contribution', p, 'Money in recorded.')}
            />
            <DisbursementForm
              season={data.season}
              readOnly={readOnly}
              onSave={(p) => run('record_disbursement', p, 'Money out recorded.')}
            />
          </div>

          <RefundQueue
            items={data.refund_queue}
            count={data.refund_queue_count}
            readOnly={readOnly}
            onRefund={(p) => run('process_refund', p, 'Entry fee refunded.')}
          />

          <ReportPanel
            report={data.transparency_report}
            url={data.public_report_url}
            season={data.season}
            readOnly={readOnly}
            onGenerate={(p) => run('generate_report', p, 'Transparency report published.')}
          />

          <TransactionsTable transactions={data.transactions} count={data.transaction_count} />
        </>
      )}
    </>
  );
}