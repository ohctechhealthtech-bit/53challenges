const APPROVAL_LABELS = {
  not_required: null,
  pending: { text: 'Awaiting your approval', cls: 'bg-amber-500/15 text-amber-300' },
  approved: { text: 'Approved by you', cls: 'bg-emerald-500/15 text-emerald-300' },
  declined: { text: 'Declined by you', cls: 'bg-red-500/15 text-red-300' },
  revoked: { text: 'Consent revoked', cls: 'bg-muted text-muted-foreground' },
};

export default function GuardianActivityList({ entries }) {
  if (!entries.length) {
    return <p className="text-sm text-muted-foreground">No activity yet — your children's challenge entries will appear here.</p>;
  }
  return (
    <ul className="space-y-2">
      {entries.map((e) => {
        const badge = APPROVAL_LABELS[e.guardian_approval_status];
        return (
          <li key={e.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-heading text-sm font-bold">{e.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {e.child_email} · {e.challenge_title || 'Challenge'} · moderation: {e.status}
                </p>
              </div>
              {badge && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.text}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}