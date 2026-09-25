/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.1 (plain language), D8.2 (same answer tiles as the wizard).
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';
import QuestionTiles from '@/components/host/QuestionTiles';
import AddonPicker from '@/components/host/AddonPicker';
import {
  CATEGORY_OPTIONS, WINNER_OPTIONS, DIVISION_OPTIONS, SCOPE_OPTIONS, PARTICIPANT_OPTIONS,
} from '@/components/host/applySteps';
import { toStructuredAnswers } from '@/lib/hostWizardDefaults';
import { useToast } from '@/components/ui/use-toast';

function Block({ title, children }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-3 font-heading text-sm font-bold">{title}</h3>
      {children}
    </div>
  );
}

export default function WorkspaceEditor({ proposal, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    challenge_title: proposal.challenge_title || '',
    challenge_description: proposal.challenge_description || '',
    category: proposal.category || '',
    participant_range: proposal.participant_range || '',
    winner_method: proposal.winner_method || '',
    divisions: proposal.divisions || [],
    program_scope: proposal.program_scope || '',
    addons: proposal.addons || [],
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('hostPortal', {
        action: 'update_proposal',
        id: proposal.id,
        patch: {
          ...form,
          scale_band: form.participant_range,
          answers: toStructuredAnswers(form),
        },
      });
      if (res.data?.error) {
        toast({ title: 'Could not save', description: res.data.error });
        return;
      }
      toast({ title: 'Saved', description: "Your challenge details have been updated." });
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {proposal.review_status === 'changes_requested' && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          Our team has asked for a few changes — update your details below and save when you're ready.
          {proposal.admin_feedback && <p className="mt-2 text-amber-200/90">{proposal.admin_feedback}</p>}
        </div>
      )}

      <Block title="What it's about">
        <div className="space-y-3">
          <input
            className="c53-input"
            aria-label="Challenge name"
            value={form.challenge_title}
            onChange={(e) => set('challenge_title', e.target.value)}
            placeholder="Give your challenge a name"
          />
          <textarea
            className="c53-input min-h-[120px]"
            aria-label="Challenge description"
            value={form.challenge_description}
            onChange={(e) => set('challenge_description', e.target.value)}
            placeholder="What would you like people to create, and why?"
          />
        </div>
      </Block>

      <Block title="What kind of entries are you after?">
        <QuestionTiles options={CATEGORY_OPTIONS} value={form.category} onChange={(v) => set('category', v)} />
      </Block>

      <Block title="How many people do you expect to take part?">
        <QuestionTiles options={PARTICIPANT_OPTIONS} value={form.participant_range} onChange={(v) => set('participant_range', v)} />
      </Block>

      <Block title="How should the winner be decided?">
        <QuestionTiles options={WINNER_OPTIONS} value={form.winner_method} onChange={(v) => set('winner_method', v)} />
      </Block>

      <Block title="Who can enter?">
        <QuestionTiles multi options={DIVISION_OPTIONS} value={form.divisions} onChange={(v) => set('divisions', v)} />
      </Block>

      <Block title="Is this a one-off, or something ongoing?">
        <QuestionTiles options={SCOPE_OPTIONS} value={form.program_scope} onChange={(v) => set('program_scope', v)} />
      </Block>

      <Block title="Services you'd like from us">
        <AddonPicker value={form.addons} onChange={(v) => set('addons', v)} />
      </Block>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="grad-bg border-0">
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}