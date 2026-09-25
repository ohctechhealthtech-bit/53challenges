/**
 * Guest details screen: visitors without an account give us their name, email
 * and organisation. Verification and payment happen on the next two screens.
 *
 * The email and organisation may already have been collected in the first
 * step (host_type → OrganisationStep) under different field names
 * (org_contact_email, org_name). Pre-fill from those so the guest is never
 * asked to type the same email twice.
 */
import { useEffect } from 'react';
import { Input } from '@/components/ui/input';

function Field({ id, label, required, children, helper }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-foreground">
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
      {helper && <p className="mb-1.5 text-xs text-muted-foreground">{helper}</p>}
      {children}
    </div>
  );
}

export default function GuestDetailsStep({ answers, set }) {
  // Auto-populate contact_email from the org_contact_email collected in step 1,
  // so the guest doesn't have to re-type it and the verify step has the address.
  useEffect(() => {
    if (!answers.contact_email && answers.org_contact_email) {
      set('contact_email', answers.org_contact_email);
    }
  }, [answers.contact_email, answers.org_contact_email, set]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="contact_name" label="Your name" required>
          <Input id="contact_name" value={answers.contact_name || ''} onChange={(e) => set('contact_name', e.target.value)} />
        </Field>
        <Field id="contact_email" label="Your email" required helper="We email your account details here.">
          <Input id="contact_email" type="email" value={answers.contact_email || answers.org_contact_email || ''} onChange={(e) => set('contact_email', e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field id="organisation_name" label="Organisation, school or group" required>
            <Input id="organisation_name" value={answers.organisation_name || answers.org_name || ''} onChange={(e) => set('organisation_name', e.target.value)} />
          </Field>
        </div>
      </div>
    </div>
  );
}