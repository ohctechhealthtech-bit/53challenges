/**
 * Visual permission matrix for the host marketplace, used in the Portal Manual.
 */
import { Check, X, Minus } from 'lucide-react';
import { HOST_ROLES } from '@/components/host/hostRoles';

const ROWS = [
  { action: 'Create a proposal', host: true, team: 'Owner / Editor', admin: true },
  { action: 'See other hosts’ proposals', host: false, team: false, admin: true },
  { action: 'Edit proposal details', host: 'While unlocked', team: 'Owner / Editor', admin: true },
  { action: 'Invite team members', host: true, team: 'Owner', admin: true },
  { action: 'Pay the deposit', host: true, team: 'Owner / Finance', admin: false },
  { action: 'Set proposal status', host: false, team: false, admin: true },
  { action: 'Approve / decline / request changes', host: false, team: false, admin: true },
  { action: 'Create the live Challenge record', host: false, team: false, admin: true },
  { action: 'Compliance, judging, audit, reporting tools', host: false, team: false, admin: true },
];

function Cell({ value }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-emerald-400" aria-label="Yes" />;
  if (value === false) return <X className="mx-auto h-4 w-4 text-red-400" aria-label="No" />;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300">
      <Minus className="h-3 w-3" /> {value}
    </span>
  );
}

export default function HostAccessMatrix() {
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="bg-muted/50 text-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 text-center font-semibold">Host (owner)</th>
              <th className="px-4 py-3 text-center font-semibold">Invited team</th>
              <th className="px-4 py-3 text-center font-semibold">53 Admin</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.action} className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">{r.action}</td>
                <td className="px-4 py-3 text-center"><Cell value={r.host} /></td>
                <td className="px-4 py-3 text-center"><Cell value={r.team} /></td>
                <td className="px-4 py-3 text-center"><Cell value={r.admin} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground">Workspace roles a host can hand out</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {HOST_ROLES.map((r) => (
            <div key={r.key} className="rounded-xl border border-border bg-card p-3">
              <p className="text-sm font-semibold text-foreground">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.description}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
        Ownership is enforced at the data layer, not just in the interface — a host can only ever read and change
        their own proposal, and status changes are admin-only.
      </p>
    </div>
  );
}