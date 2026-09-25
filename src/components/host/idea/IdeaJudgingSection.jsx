/**
 * Judging is a fixed platform policy — hosts are told how it works, they
 * never choose the panel or the method here.
 */
import { Lock, ShieldCheck } from 'lucide-react';

export default function IdeaJudgingSection() {
  return (
    <div>
      <p className="mb-2.5 text-sm font-semibold">How judging works</p>
      <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="flex items-center gap-2 text-sm font-bold">
            Public votes + judges
            <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </p>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Every challenge uses our standard judging policy. Winners are decided by our combined system of
          public votes and judges&rsquo; scores, we put the judging panel together for you, and we set the
          scoring method — so there&rsquo;s nothing for you to set up.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Every judge scores from their own account and all judging activity is recorded for transparency.
          If you&rsquo;d like particular people involved, just mention it when we talk.
        </p>
      </div>
    </div>
  );
}