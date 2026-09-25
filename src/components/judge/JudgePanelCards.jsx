// Judge Panel — one card per panel judge: submission state and normalised score.
import { CheckCircle2, Clock, ShieldCheck, User } from 'lucide-react';

export default function JudgePanelCards({ judges = [], revealed = true, judgesTotal }) {
  if (!judges.length) return null;

  return (
    <div>
      <h3 className="mb-2 text-sm font-bold">Judge Panel</h3>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {judges.map((j, i) => (
          <div
            key={`${j.label}-${i}`}
            className={`rounded-2xl border bg-card p-3 text-center ${j.is_me ? 'border-success/50' : 'border-border'}`}
          >
            <p className="text-sm font-bold">
              {j.label}
              {j.is_me && <span className="ml-1 text-primary">(You)</span>}
            </p>
            {j.round_title && <p className="text-[11px] text-muted-foreground">{j.round_title}</p>}
            <span className="mx-auto my-2 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <User className="h-5 w-5 text-muted-foreground" />
            </span>
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
              <ShieldCheck className="h-3 w-3" /> Conflict cleared
            </p>
            <div className={`mt-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold ${
              j.submitted ? 'border-success/40 bg-success/10 text-success' : 'border-border text-muted-foreground'
            }`}>
              {j.submitted ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {j.submitted ? 'Submitted' : 'Pending'}
            </div>
            <p className="mt-2 font-heading text-3xl font-bold leading-none text-success">
              {j.normalised != null ? Number(j.normalised).toFixed(0) : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground">/ 100</p>
          </div>
        ))}
      </div>
      {!revealed && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Scores are hidden until all {judgesTotal || judges.length} panel judges have submitted.
        </p>
      )}
    </div>
  );
}