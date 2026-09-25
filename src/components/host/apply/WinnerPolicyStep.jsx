/**
 * Fixed platform policy for how winners are decided. Hosts read it and confirm
 * they accept it — nothing here is configurable.
 */
import { Scale, Users, ShieldCheck, Stamp } from 'lucide-react';

const POINTS = [
  {
    icon: Scale,
    title: 'Weighted official score',
    body: 'Every finalist receives a qualified judge panel score and a verified public vote score. The official result combines both using the published weighting for the round.',
  },
  {
    icon: Users,
    title: 'Qualified, conflict-free judges',
    body: 'Judges are approved for the category they score and must complete a conflict-of-interest declaration before they can score any entry.',
  },
  {
    icon: ShieldCheck,
    title: 'Vote integrity review',
    body: 'Public votes are reviewed for abuse before results are calculated. Votes found to be invalid are never counted.',
  },
  {
    icon: Stamp,
    title: 'Results approval and sign-off',
    body: 'Results are approved internally, signed off by an independent scrutineer where required, and only then published. Hosts cannot change results after voting closes.',
  },
];

export default function WinnerPolicyStep({ accepted, onAccept }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Winners are decided by our standard, published selection process — it's the same for every challenge on the
        platform, so results stay fair and defensible.
      </p>

      {POINTS.map((p) => {
        const Icon = p.icon;
        return (
          <div key={p.title} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold">{p.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
            </div>
          </div>
        );
      })}

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-secondary/60 p-4">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[--primary]"
          checked={!!accepted}
          onChange={(e) => onAccept(e.target.checked)}
        />
        <span className="text-sm">
          I have read and accept the judging and results policy for my challenge, including the judge panel and public
          vote weighting, the integrity review, and the results approval process.
        </span>
      </label>
    </div>
  );
}