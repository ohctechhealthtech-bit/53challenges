import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STATUS_LABELS, fmtDate } from './hostRequestMeta';

export default function HostRequestTable({ requests, onOpen }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Request</th>
            <th className="px-4 py-3">Requester</th>
            <th className="px-4 py-3">Organisation</th>
            <th className="px-4 py-3">Submitted</th>
            <th className="px-4 py-3">Age</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="px-4 py-3 font-semibold">
                {!r.is_read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" />}
                {r.working_title || 'Untitled request'}
                {(r.converted_challenge_id || r.challenge_id) && (
                  <span className="ml-2 rounded bg-success/20 px-1.5 py-0.5 text-[11px] font-bold text-success">Converted</span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {r.contact_name || '—'}<br />{r.contact_email}
              </td>
              <td className="px-4 py-3">{r.company_name || '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.submitted_at)}</td>
              <td className="px-4 py-3">{r.age_days ?? 0}d</td>
              <td className="px-4 py-3">{STATUS_LABELS[r.status] || r.status}</td>
              <td className="px-4 py-3 text-right">
                <Button variant="outline" size="sm" onClick={() => onOpen(r)}>
                  <Eye className="h-3.5 w-3.5" /> View
                </Button>
              </td>
            </tr>
          ))}
          {requests.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No requests in this view.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}