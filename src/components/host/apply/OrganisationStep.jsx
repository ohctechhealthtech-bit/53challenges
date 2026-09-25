/**
 * Step 2 of the host application — who the challenge is being run for.
 *
 * 1. host_type tiles (just me / business / school-community).
 * 2. Host details — only for hosts with no saved workspace; the organisation
 *    is created server-side as soon as this step is completed.
 * 3. beneficiary_for — required for everyone: their own organisation, or
 *    organised for someone else (which asks who they are and who to talk to).
 */
import { Building2 } from 'lucide-react';
import QuestionTiles from '@/components/host/QuestionTiles';
import { HOST_TYPE_OPTIONS } from '@/components/host/applySteps';
import OrganisationChoiceTiles from '@/components/host/apply/OrganisationChoiceTiles';
import BeneficiaryFields from '@/components/host/apply/BeneficiaryFields';
import FieldError, { errorRing } from '@/components/host/apply/FieldError';

const KINDS = [
  { value: 'business', label: 'Business' },
  { value: 'school', label: 'School' },
  { value: 'community_group', label: 'Community group' },
  { value: 'club', label: 'Club' },
  { value: 'council', label: 'Council' },
  { value: 'individual_host', label: 'Just me' },
];

export default function OrganisationStep({ organisation, answers, set, errors = [], isAuthenticated = false }) {
  const field = (k) => (e) => set(k, e.target.value);
  const mode = answers.beneficiary_for || '';
  const errorFor = (k) => errors.find((e) => e.field === k)?.message || '';
  const inputProps = (k) => {
    const message = errorFor(k);
    return {
      className: `c53-input ${errorRing(message)}`.trim(),
      'aria-invalid': message ? 'true' : undefined,
      'aria-describedby': message ? `${k}-error` : undefined,
    };
  };

  // Switching between "my company" and "someone else" also resets the
  // beneficiary name, so stale answers never linger.
  const chooseBeneficiary = (v) => {
    set('beneficiary_for', v);
    if (v === 'my_org') {
      set('beneficiary_name', organisation?.name || answers.org_name || 'My own organisation');
    } else if (!answers.beneficiary_name || answers.beneficiary_name === (organisation?.name || answers.org_name)) {
      set('beneficiary_name', '');
    }
  };

  return (
    <div className="space-y-8">
      <QuestionTiles
        options={HOST_TYPE_OPTIONS}
        value={answers.host_type}
        onChange={(v) => set('host_type', v)}
      />

      {organisation ? (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <Building2 className="h-6 w-6 text-primary" aria-hidden="true" />
          <div>
            <p className="font-heading text-sm font-bold">{organisation.name}</p>
            <p className="text-xs text-muted-foreground">Your saved organisation — it stays the same for every challenge.</p>
          </div>
        </div>
      ) : answers.host_type !== 'individual' ? (
        <div className="space-y-5 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            {isAuthenticated
              ? "Tell us who's hosting — we'll save this to your workspace, so you only do it once."
              : "Tell us who's hosting — we'll set up your workspace from these details."}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="org_name" className="mb-1 block text-sm font-semibold">Organisation, school or group name *</label>
              <input id="org_name" {...inputProps('org_name')} value={answers.org_name || ''} onChange={field('org_name')} />
              <FieldError id="org_name-error" message={errorFor('org_name')} />
            </div>
            <div>
              <label htmlFor="org-kind" className="mb-1 block text-sm font-semibold">What kind of organisation? *</label>
              <select id="org-kind" className="c53-input" value={answers.org_kind || 'business'} onChange={field('org_kind')}>
                {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="org-state" className="mb-1 block text-sm font-semibold">
                State <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input id="org-state" className="c53-input" placeholder="NSW" value={answers.org_state || ''} onChange={field('org_state')} />
            </div>
            <div>
              <label htmlFor="contact_name" className="mb-1 block text-sm font-semibold">Your name *</label>
              <input id="contact_name" {...inputProps('contact_name')} value={answers.contact_name || ''} onChange={field('contact_name')} />
              <FieldError id="contact_name-error" message={errorFor('contact_name')} />
            </div>
            <div>
              <label htmlFor="org_contact_email" className="mb-1 block text-sm font-semibold">Contact email *</label>
              <input id="org_contact_email" type="email" {...inputProps('org_contact_email')} value={answers.org_contact_email || ''} onChange={field('org_contact_email')} />
              <FieldError id="org_contact_email-error" message={errorFor('org_contact_email')} />
            </div>
            <div>
              <label htmlFor="contact-phone" className="mb-1 block text-sm font-semibold">
                Contact phone <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input id="contact-phone" type="tel" className="c53-input" value={answers.contact_phone || ''} onChange={field('contact_phone')} />
            </div>
            <div>
              <label htmlFor="org-abn" className="mb-1 block text-sm font-semibold">
                ABN <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input id="org-abn" className="c53-input" value={answers.org_abn || ''} onChange={field('org_abn')} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-5 border-t border-border pt-6">
        <div>
          <p className="mb-2 block text-sm font-semibold">
            Who is this challenge being organised for? <span className="font-normal text-destructive">(required)</span>
          </p>
          <OrganisationChoiceTiles
            orgName={organisation?.name || answers.org_name || ''}
            isIndividual={answers.host_type === 'individual'}
            value={mode}
            onChange={chooseBeneficiary}
          />
          <FieldError id="beneficiary_for-error" message={errorFor('beneficiary_for')} />
        </div>

        {mode === 'other' && <BeneficiaryFields answers={answers} set={set} errorFor={errorFor} />}

        {mode && (
          <div>
            <label htmlFor="beneficiary-notes" className="mb-1 block text-sm font-semibold">
              {mode === 'other' ? 'Anything we should know about them?' : 'Anything we should know?'}{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <p className="mb-2 text-xs text-muted-foreground">
              A sentence about who they are and why you're running this challenge.
            </p>
            <textarea
              id="beneficiary-notes"
              rows={3}
              className="c53-input"
              placeholder="e.g. A regional school running a term-long art program for years 3–6."
              value={answers.beneficiary_notes || ''}
              onChange={field('beneficiary_notes')}
            />
          </div>
        )}
      </div>
    </div>
  );
}