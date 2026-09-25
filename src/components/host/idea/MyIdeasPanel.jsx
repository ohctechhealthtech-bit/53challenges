/** Shows the signed-in host their previous ideas on step 1 of the wizard. */
import { ideaStatusLabel } from '@/components/dashboard/ideaLabels';

export default function MyIdeasPanel({ ideas }) {
  if (!ideas?.length) return null;

  return (
    <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <p className="text-sm font-bold text-primary">
        {ideas.length === 1 ? 'You’ve already shared one idea with us' : `You’ve already shared ${ideas.length} ideas with us`}
      </p>
      <ul className="mt-3 space-y-2">
        {ideas.slice(0, 5).map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2 text-sm">
            <span className="font-semibold">{i.challenge_title || 'Untitled idea'}</span>
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">
              {ideaStatusLabel(i.review_status)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        We’ve filled in your details below — just tell us about the new idea.
      </p>
    </div>
  );
}