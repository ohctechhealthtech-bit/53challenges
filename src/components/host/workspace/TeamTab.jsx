/**
 * Team tab — who has access to this host workspace.
 */
import { Users } from 'lucide-react';
import { getHostRole } from '@/components/host/hostRoles';

export default function TeamTab({ team }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Users className="h-3.5 w-3.5" /> Your team
      </p>
      {team.length === 0 ? (
        <p className="text-sm text-muted-foreground">Just you for now.</p>
      ) : (
        <ul className="divide-y divide-border">
          {team.map((m) => {
            const role = getHostRole(m.role);
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{m.name || m.email}</span>
                  <span className="text-xs text-muted-foreground">{m.email}</span>
                </span>
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {role.name}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Need to add someone? Let us know and we'll set them up with the right access.
      </p>
    </div>
  );
}