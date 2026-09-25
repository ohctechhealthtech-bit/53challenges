import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import ConceptPackStep from './ConceptPackStep';
import RulesPackStep from './RulesPackStep';
import BrandPackStep from './BrandPackStep';
import ParticipationPackStep from './ParticipationPackStep';
import OperationsPackStep from './OperationsPackStep';
import LegalPackStep from './LegalPackStep';
import RecommendationConfigFields from './RecommendationConfigFields';

const STEPS = ['Concept', 'Rules', 'Brand', 'Participation', 'Operations', 'Legal', 'Review & publish'];

export default function TemplateWizard({ template, onSave, onPublish, onCancel, busy, errors }) {
  const [draft, setDraft] = useState(template);
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);

  const change = (patch) => { setDraft((d) => ({ ...d, ...patch })); setDirty(true); };
  const save = async () => { await onSave(draft); setDirty(false); };
  const cancel = () => {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    onCancel();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${i === step ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'}`}
          >
            {i + 1}. {s}
          </button>
        ))}
        {dirty && <span className="ml-auto text-xs font-semibold text-gold">Unsaved changes</span>}
      </div>

      <div className="mt-6">
        {step === 0 && <ConceptPackStep template={draft} onChange={change} />}
        {step === 1 && <RulesPackStep template={draft} onChange={change} />}
        {step === 2 && <BrandPackStep template={draft} onChange={change} />}
        {step === 3 && <ParticipationPackStep template={draft} onChange={change} />}
        {step === 4 && <OperationsPackStep template={draft} onChange={change} />}
        {step === 5 && <LegalPackStep template={draft} onChange={change} />}
        {step === 6 && (
          <div className="space-y-5">
            <RecommendationConfigFields template={draft} onChange={change} />
            {errors === null ? (
              <p className="text-sm text-muted-foreground">Save the draft, then publish to run all checks.</p>
            ) : errors.length === 0 ? (
              <p className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 p-3 text-sm font-semibold text-success">
                <CheckCircle2 className="h-4 w-4" /> All checks passed — ready to publish.
              </p>
            ) : (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3">
                <p className="flex items-center gap-2 text-sm font-bold text-destructive">
                  <AlertCircle className="h-4 w-4" /> {errors.length} item{errors.length === 1 ? '' : 's'} to fix before publishing
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Previous</Button>
        <Button variant="outline" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={step === STEPS.length - 1}>Continue</Button>
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Save draft
        </Button>
        <Button onClick={async () => { await save(); await onPublish(draft); }} disabled={busy} className="bg-success text-white hover:bg-success/90">
          Publish
        </Button>
        <button type="button" onClick={cancel} className="ml-auto text-sm font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
      </div>
    </div>
  );
}