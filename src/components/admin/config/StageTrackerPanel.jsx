import { useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import StageActionDialog from './StageActionDialog';
import { STEP_TONE } from './configMeta';

const ACTION_API = {
  set_stage: (p) => adminChallengeApi.configSetStage(p),
  select_finalists: (p) => adminChallengeApi.configSelectFinalists(p),
  open_final_round: (p) => adminChallengeApi.configOpenFinalRound(p),
  compute_results: (p) => adminChallengeApi.configComputeResults(p),
};

export default function StageTrackerPanel({ challengeId, tracker, actingEmail, onChanged }) {
  const [pending, setPending] = useState(null);

  const gates = tracker.gates || {};
  const gateChips = [
    tracker.config_locked && { label: 'Configuration locked', tone: 'bg-muted text-muted-foreground' },
    gates.integrity_review_required && { label: 'Integrity review required', tone: 'bg-gold/15 text-gold' },
    gates.scrutineer_required && {
      label: gates.scrutineer_signed_off ? 'Scrutineer signed off' : 'Scrutineer sign-off outstanding',
      tone: gates.scrutineer_signed_off ? 'bg-success/15 text-success' : 'bg-gold/15 text-gold',
    },
    { label: gates.finalists_confirmed ? 'Finalists confirmed' : 'Finalists not confirmed', tone: gates.finalists_confirmed ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground' },
    { label: gates.final_round_opened ? 'Final round opened' : 'Final round not opened', tone: gates.final_round_opened ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground' },
  ].filter(Boolean);

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-bold">Round stage: {tracker.current_label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{tracker.current_hint}</p>
        </div>
        {tracker.config_locked && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm">
            <Lock className="h-3.5 w-3.5" /> Config locked
          </span>
        )}
      </div>

      <ol className="mt-5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {(tracker.steps || []).map((s, i) => (
          <li key={s.key} className={`flex items-start gap-2.5 rounded-xl px-3 py-2 ${s.state === 'current' ? 'bg-primary/10' : ''}`}>
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${STEP_TONE[s.state] || STEP_TONE.upcoming}`}>
              {s.state === 'done' ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span>
              <span className={`block text-sm font-semibold ${s.state === 'upcoming' ? 'text-muted-foreground' : ''}`}>{s.label}</span>
              <span className="block text-xs text-muted-foreground">{s.hint}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-wrap gap-2">
        {gateChips.map((c) => (
          <span key={c.label} className={`rounded-full px-3 py-1 text-xs font-semibold ${c.tone}`}>{c.label}</span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(tracker.available_actions || []).map((a) => (
          <Button
            key={a.action + (a.stage || '')}
            variant={a.action === 'set_stage' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPending(a)}
          >
            {a.label}
          </Button>
        ))}
        {(tracker.available_actions || []).length === 0 && (
          <p className="text-sm text-muted-foreground">No stage actions are available right now.</p>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{tracker.note}</p>

      {pending && (
        <StageActionDialog
          open={!!pending}
          onOpenChange={(v) => !v && setPending(null)}
          action={pending}
          withReason={pending.action === 'set_stage'}
          run={(reason) =>
            ACTION_API[pending.action]({
              challengeId,
              ...(pending.action === 'set_stage' ? { stage: pending.stage, ...(reason ? { reason } : {}) } : {}),
              actingEmail,
            })
          }
          onDone={async () => { setPending(null); await onChanged(); }}
        />
      )}
    </section>
  );
}