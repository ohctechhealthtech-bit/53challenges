/** The judging panel the host asked for on a "Tell us your idea" submission. */
import { ideaLabel } from '@/components/dashboard/ideaLabels';

export default function IdeaJudgingDetail({ answers }) {
  const judges = Array.isArray(answers.invited_judges) ? answers.invited_judges : [];
  if (!answers.judging_source && !judges.length) return null;

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4">
      <h4 className="text-sm font-bold">Judging panel</h4>
      <p className="mt-2 text-sm font-medium">{ideaLabel('judging_source', answers.judging_source)}</p>

      {judges.length ? (
        <ul className="mt-3 space-y-1.5">
          {judges.map((j) => (
            <li key={j.email} className="text-sm">
              <span className="font-medium">{j.name}</span>{' '}
              <span className="text-muted-foreground">· {j.email}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {answers.platform_judges_notes ? (
        <p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          Wants in a platform judge: {answers.platform_judges_notes}
        </p>
      ) : null}
    </div>
  );
}