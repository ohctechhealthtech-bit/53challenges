import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SERVICE_TIERS } from '@/lib/templateLibrary';

const ORG_TYPES = ['school', 'workplace', 'club', 'community_group', 'council', 'business'];

export default function TemplateIntakeForm({ onSubmit, busy }) {
  const [answers, setAnswers] = useState({
    organisation_type: 'school',
    category: '',
    audience_type: '',
    participant_count: 100,
    service_tier: 'standard',
  });
  const set = (patch) => setAnswers((a) => ({ ...a, ...patch }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(answers); }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <h2 className="font-heading text-xl font-extrabold">Tell us a little about your challenge</h2>
      <p className="mt-1 text-sm text-muted-foreground">Five quick questions — then we'll show you the packages that fit best.</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold">What kind of organisation are you?</span>
          <select className="c53-input mt-1.5" value={answers.organisation_type} onChange={(e) => set({ organisation_type: e.target.value })}>
            {ORG_TYPES.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">What sort of challenge?</span>
          <input className="c53-input mt-1.5" placeholder="e.g. art, writing, fitness" value={answers.category} onChange={(e) => set({ category: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Who will take part?</span>
          <input className="c53-input mt-1.5" placeholder="e.g. students, staff, families" value={answers.audience_type} onChange={(e) => set({ audience_type: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Roughly how many people?</span>
          <input type="number" min="1" className="c53-input mt-1.5" value={answers.participant_count} onChange={(e) => set({ participant_count: Number(e.target.value) })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">How much help would you like?</span>
          <select className="c53-input mt-1.5" value={answers.service_tier} onChange={(e) => set({ service_tier: e.target.value })}>
            {SERVICE_TIERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <Button type="submit" className="mt-6" disabled={busy}>Show my options</Button>
    </form>
  );
}