import { CheckCircle2 } from 'lucide-react';

/** "Your Mission" — the brief plus a checklist of the key requirements. */
export default function IntroMission({ body, requirements }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-heading text-lg font-bold">Your Mission</h2>
      {body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{body}</p>}
      {requirements.length > 0 && (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {requirements.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span className="text-muted-foreground">{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}