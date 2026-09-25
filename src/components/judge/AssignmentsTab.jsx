// My assignments — pending invitations and accepted challenges.
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { judgeApi, pickList } from '@/lib/judgeApi';
import { PanelLoading, PanelError } from '@/components/judge/PanelStates';
import PendingAssignmentCard from '@/components/judge/PendingAssignmentCard';
import AcceptedAssignmentCard from '@/components/judge/AcceptedAssignmentCard';

const rowId = (r) => r.assignment_id || r.id;
const scopeKey = (r) => String(r.round_id || rowId(r));
const statusOf = (r) => (r.status || 'pending').toLowerCase();

export default function AssignmentsTab({ refreshKey, onJudge }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const load = () => {
    setError('');
    setRows(null);
    judgeApi('judge-assignments')
      .then((d) => setRows(pickList(d, ['assignments', 'rows', 'items'])))
      .catch((e) => setError(e.message));
  };
  useEffect(load, [refreshKey]);

  const respond = async (row, response) => {
    setActionError('');
    try {
      await judgeApi('judge-assignment-respond', {
        assignment_id: rowId(row), response, round_id: row.round_id || '',
      });
      setRows((list) => list.map((r) => (rowId(r) === rowId(row) ? { ...r, status: response } : r)));
    } catch (e) {
      setActionError(e.message);
    }
  };

  if (error) return <PanelError message={error} onRetry={load} />;
  if (!rows) return <PanelLoading label="Loading your assignments…" />;

  const pending = rows.filter((r) => statusOf(r) === 'pending');
  const accepted = rows.filter((r) => statusOf(r) === 'accepted');

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-bold">My assignments</h2>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {actionError && <p className="mb-3 text-sm text-destructive">{actionError}</p>}

      <section className="mb-8">
        <h3 className="mb-3 font-bold">Pending requests ({pending.length})</h3>
        {pending.length ? (
          <div className="space-y-4">
            {pending.map((r) => (
              <PendingAssignmentCard key={rowId(r)} row={r} onRespond={respond} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No pending judging requests.</p>
        )}
      </section>

      <section>
        <h3 className="mb-3 font-bold">Accepted challenges ({accepted.length})</h3>
        {accepted.length ? (
          <div className="space-y-4">
            {accepted.map((r) => (
              <AcceptedAssignmentCard
                key={rowId(r)}
                row={r}
                scopeKey={scopeKey(r)}
                onRespond={respond}
                onJudge={onJudge}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">You haven't accepted any judging assignments yet.</p>
        )}
      </section>
    </div>
  );
}