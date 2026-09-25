# /host-apply — Part 3: Step Components

This is part 3. See also:
- `HOST_APPLY_PART1_API_PAGE.md` — API reference & page
- `HOST_APPLY_PART2_WIZARD.md` — Wizard model, screen router, shell
- `HOST_APPLY_PART4_SUPPORT.md` — Supporting components, hooks, shared logic, entities

---

## OrganisationStep.jsx

**File:** `src/components/host/apply/OrganisationStep.jsx`

```jsx
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
      ) : isAuthenticated ? (
        <div className="space-y-5 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            Tell us who's hosting — we'll save this to your workspace, so you only do it once.
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
```

---

## PackageStep.jsx

**File:** `src/components/host/apply/PackageStep.jsx`

```jsx
/**
 * Package choice for the host apply wizard — each tile shows price, deposit
 * note and the services included so hosts can compare before choosing.
 */
import { Check, Star } from 'lucide-react';
import useHostPackages from '@/hooks/useHostPackages';

export default function PackageStep({ value, onChange }) {
  const { packages } = useHostPackages();

  return (
    <div className="grid gap-4 lg:grid-cols-3" role="radiogroup" aria-label="Hosting package">
      {packages.map((pkg) => {
        const selected = value === pkg.key;
        return (
          <button
            key={pkg.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(pkg.key)}
            className={`relative flex flex-col rounded-2xl border-2 p-5 text-left transition ${
              selected ? 'border-primary bg-primary/5 shadow-md' : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            {pkg.badge && (
              <span className="absolute -top-3 left-4 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-white">
                {pkg.highlight && <Star className="h-3 w-3 fill-gold text-gold" />} {pkg.badge}
              </span>
            )}
            {selected && <Check className="absolute right-4 top-4 h-5 w-5 text-primary" aria-hidden="true" />}

            <h3 className="font-heading text-lg font-extrabold">{pkg.name}</h3>
            <p className="text-sm font-semibold text-primary">{pkg.tagline}</p>
            {pkg.headline && <p className="mt-1 text-xs text-muted-foreground">{pkg.headline}</p>}

            <div className="mt-4">
              <p className="font-heading text-2xl font-extrabold">{pkg.price}</p>
              {pkg.priceNote && <p className="mt-0.5 text-xs text-muted-foreground">{pkg.priceNote}</p>}
            </div>

            <ul className="mt-4 flex-1 space-y-2 border-t border-border pt-4">
              {(pkg.benefits || []).map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {b.endsWith('plus:') ? (
                    <span className="font-semibold text-muted-foreground">{b}</span>
                  ) : (
                    <>
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      <span>{b}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
```

---

## GuestDetailsStep.jsx

**File:** `src/components/host/apply/GuestDetailsStep.jsx`

```jsx
/**
 * Guest details screen: visitors without an account give us their name, email
 * and organisation. Verification and payment happen on the next two screens.
 */
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
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="contact_name" label="Your name" required>
          <Input id="contact_name" value={answers.contact_name || ''} onChange={(e) => set('contact_name', e.target.value)} />
        </Field>
        <Field id="contact_email" label="Your email" required helper="We email your account details here.">
          <Input id="contact_email" type="email" value={answers.contact_email || ''} onChange={(e) => set('contact_email', e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field id="organisation_name" label="Organisation, school or group" required>
            <Input id="organisation_name" value={answers.organisation_name || ''} onChange={(e) => set('organisation_name', e.target.value)} />
          </Field>
        </div>
      </div>
    </div>
  );
}
```

---

## EmailVerifyStep.jsx

**File:** `src/components/host/apply/EmailVerifyStep.jsx`

```jsx
/**
 * Email verification step — sits between the wizard details and the payment
 * screen. Auto-sends a 6-digit code on mount, then shows a "Continue to
 * payment" button once the code is confirmed.
 */
import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendEmailCode, verifyEmailCode } from '@/lib/emailVerification';

const RESEND_SECONDS = 45;

export default function EmailVerifyStep({ email, verified, onVerified, onAdvance }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const didAutoSend = useRef(false);

  useEffect(() => {
    if (verified || !email || didAutoSend.current) return;
    didAutoSend.current = true;
    send();
  }, [verified, email]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const send = async () => {
    setBusy(true); setError('');
    const r = await sendEmailCode(email, 'host_application');
    setBusy(false);
    if (r.error) return setError(r.error);
    setResendIn(RESEND_SECONDS);
  };

  const confirm = async () => {
    setBusy(true); setError('');
    const r = await verifyEmailCode(email, 'host_application', code);
    setBusy(false);
    if (r.error) return setError(r.error);
    onVerified(r.verification_token || '');
  };

  if (verified) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-bold text-stone-900">Email verified</p>
            <p className="mt-0.5 text-sm text-stone-600">{email}</p>
          </div>
        </div>
        <Button onClick={onAdvance} className="w-full grad-bg border-0">
          Continue to payment <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
          <ShieldCheck className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <p className="font-bold text-stone-900">Verify it&rsquo;s you</p>
          <p className="mt-0.5 text-sm text-stone-600">
            We sent a 6-digit code to <span className="font-semibold">{email}</span>. Enter it to confirm you own this email.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="otp-code" className="mb-1.5 block text-xs font-medium text-stone-500">
          Enter the 6-digit code
        </label>
        <div className="flex items-center gap-3">
          <Input
            id="otp-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="• • • • • •"
            className="flex-1 tracking-[0.3em] bg-white"
          />
          <Button
            type="button"
            onClick={confirm}
            disabled={busy || code.length !== 6}
            className="gap-2 bg-orange-400 text-white hover:bg-orange-500"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Verify
          </Button>
        </div>
      </div>

      <div className="mt-3">
        {resendIn > 0 ? (
          <p className="text-xs text-stone-400">Resend in {resendIn}s</p>
        ) : (
          <button type="button" onClick={send} disabled={busy} className="text-xs text-stone-500 underline hover:text-stone-700">
            Resend code
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

---

## ApplicationFinalStep.jsx

**File:** `src/components/host/apply/ApplicationFinalStep.jsx`

```jsx
/**
 * Final wizard step: live price breakdown, then either the in-app payment
 * (paid packages/add-ons) or a direct submit (nothing to pay).
 * Sign-in is required here only — the earlier steps are open to everyone.
 */
import { useState } from 'react';
import { Loader2, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hostPortal } from '@/lib/hostPortalClient';
import PricingSummary from '@/components/host/apply/PricingSummary';
import ApplicationPaymentStep from '@/components/host/apply/ApplicationPaymentStep';

function SignInPrompt() {
  const returnTo = encodeURIComponent(window.location.href);
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center">
      <p className="font-heading text-base font-bold">Sign in to finish your application</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        We save your application, package and payment to your account so you can pick it up any time
        and follow your challenge once it's live.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild className="grad-bg border-0">
          <a href={`/login?returnTo=${returnTo}`}><LogIn className="mr-2 h-4 w-4" /> Sign in</a>
        </Button>
        <Button asChild variant="outline">
          <a href={`/register?returnTo=${returnTo}`}><UserPlus className="mr-2 h-4 w-4" /> Create an account</a>
        </Button>
      </div>
    </div>
  );
}

export default function ApplicationFinalStep({ draftId, answers, onSubmitted, isAuthenticated, isLoadingAuth }) {
  const [pricing, setPricing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (invoiceId) => {
    setSubmitting(true);
    setError('');
    try {
      await hostPortal('submit_application', { draft_id: draftId, answers, invoice_id: invoiceId || undefined });
      onSubmitted();
    } catch (e) {
      setError(e?.message || 'We could not send your application just now');
      setSubmitting(false);
      throw e;
    }
  };

  const needsSignIn = !isLoadingAuth && !isAuthenticated;

  return (
    <div className="space-y-6">
      <PricingSummary answers={answers} onPricing={setPricing} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {needsSignIn ? (
        <SignInPrompt />
      ) : (
        pricing && (pricing.payment_required ? (
          <ApplicationPaymentStep draftId={draftId} answers={answers} onPaid={submit} />
        ) : (
          <Button onClick={() => submit(null)} disabled={submitting} className="w-full grad-bg border-0">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send my application
          </Button>
        ))
      )}
    </div>
  );
}
```

---

## ApplicationPaymentStep.jsx

**File:** `src/components/host/apply/ApplicationPaymentStep.jsx`

```jsx
/**
 * In-app payment for the host application: start_application_payment →
 * Stripe Elements → confirm_payment → onPaid(invoiceId).
 */
import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2, Lock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hostPortal } from '@/lib/hostPortalClient';
import { formatAud } from '@/lib/hostDeposit';

function PayForm({ amount, invoiceId, clientSecret, onPaid }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');

  const pay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setMessage('');

    const existing = await stripe.retrievePaymentIntent(clientSecret);
    const alreadyPaid = existing?.paymentIntent?.status === 'succeeded';

    if (!alreadyPaid) {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });
      if (error && !(error.code === 'payment_intent_unexpected_state' && error.payment_intent?.status === 'succeeded')) {
        setMessage(error.message || 'Payment could not be completed');
        setProcessing(false);
        return;
      }
    }
    try {
      await hostPortal('confirm_payment', { invoice_id: invoiceId });
      await onPaid(invoiceId);
    } catch (err) {
      setMessage(err?.message || 'Payment went through, but we could not send your application.');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={pay} className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <PaymentElement />
      </div>
      {message && (
        <p className="flex items-center gap-1 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {message}
        </p>
      )}
      <Button type="submit" disabled={!stripe || processing} className="w-full grad-bg border-0">
        {processing ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
        ) : (
          <>Pay {formatAud(amount / 100)} &amp; send my application</>
        )}
      </Button>
      <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" /> Secure payment, handled by Stripe
      </p>
    </form>
  );
}

export default function ApplicationPaymentStep({ draftId, answers, onPaid }) {
  const [state, setState] = useState({ loading: true, error: '' });
  const [stripePromise, setStripePromise] = useState(null);
  const [clientSecret, setClientSecret] = useState('');
  const [amount, setAmount] = useState(0);
  const [invoiceId, setInvoiceId] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ loading: true, error: '' });
    hostPortal('start_application_payment', { draft_id: draftId, answers })
      .then((data) => {
        if (!active) return;
        setClientSecret(data.client_secret);
        setAmount(data.amount || 0);
        setInvoiceId(data.invoice_id);
        setStripePromise(loadStripe(data.publishable_key));
        setState({ loading: false, error: '' });
      })
      .catch((e) => { if (active) setState({ loading: false, error: e?.message || 'Payment setup unavailable' }); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (state.error || !stripePromise || !clientSecret) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
        <p className="font-semibold">We couldn't open the payment form just now</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.error || "Please try again in a moment, or contact us and we'll take your payment another way."}
        </p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => setAttempt((a) => a + 1)}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
      <PayForm amount={amount} invoiceId={invoiceId} clientSecret={clientSecret} onPaid={onPaid} />
    </Elements>
  );
}
```

---

## JudgesStep.jsx

**File:** `src/components/host/apply/JudgesStep.jsx`

```jsx
/**
 * Judging question — hosts either use judges from our panel (loaded from the
 * judges master), bring their own, or mix both. Host-added judges are added
 * to the judge list straight away and linked to this application.
 */
import { useEffect, useState } from 'react';
import { Plus, Award, UserPlus, Users } from 'lucide-react';
import QuestionTiles from '@/components/host/QuestionTiles';
import PlatformJudgePicker from '@/components/host/apply/PlatformJudgePicker';
import HostJudgeRow from '@/components/host/apply/HostJudgeRow';
import { judgesMaster } from '@/lib/judgesMaster';
import { hostPortalJudges } from '@/lib/hostPortalJudges';

const SOURCE_OPTIONS = [
  { value: 'platform', label: 'Use our judges', description: 'Pick from our panel, or let us appoint them.', icon: Award },
  { value: 'host', label: 'Add my own judges', description: 'You nominate the people who will score entries.', icon: UserPlus },
  { value: 'both', label: 'A mix of both', description: 'Your judges sit alongside ours on the panel.', icon: Users },
];

const BLANK = { name: '', email: '', level: 'state', disciplines: [], id: '' };

export default function JudgesStep({ answers, set }) {
  const source = answers.judge_source || 'platform';
  const judges = answers.host_judges?.length ? answers.host_judges : [BLANK];
  const needsOwn = source === 'host' || source === 'both';
  const usesOurs = source === 'platform' || source === 'both';
  const selected = answers.selected_judge_ids || [];

  const [pool, setPool] = useState([]);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    hostPortalJudges
      .panel()
      .then((res) => setPool(res.judges || []))
      .catch(() => setError('We could not load our judge list just now — we can appoint judges for you.'))
      .finally(() => setLoading(false));
    judgesMaster.options().then(setOptions).catch(() => {});
  }, []);

  const replace = (i, next) => set('host_judges', judges.map((j, idx) => (idx === i ? next : j)));
  const toggleSelected = (id) =>
    set('selected_judge_ids', selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="space-y-6">
      <QuestionTiles options={SOURCE_OPTIONS} value={source} onChange={(v) => set('judge_source', v)} />

      {usesOurs && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <PlatformJudgePicker
            judges={pool}
            loading={loading}
            error={error}
            selected={selected}
            onToggle={toggleSelected}
          />
        </div>
      )}

      {needsOwn && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add the people you'd like on the panel — they're added to your panel straight away and we'll invite them.
          </p>
          {judges.map((j, i) => (
            <HostJudgeRow
              key={i}
              index={i}
              judge={j}
              options={options}
              onChange={(next) => replace(i, next)}
              onRemove={judges.length > 1 ? () => set('host_judges', judges.filter((_, idx) => idx !== i)) : null}
            />
          ))}
          <button
            type="button"
            onClick={() => set('host_judges', [...judges, { ...BLANK }])}
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm font-semibold transition hover:border-primary/50"
          >
            <Plus className="h-4 w-4" /> Add another judge
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## DatesStep.jsx

**File:** `src/components/host/apply/DatesStep.jsx`

```jsx
/**
 * "When does your challenge run?" — required start/end dates plus an optional
 * voting-close date, with inline validation. D8: plain language, calm feedback.
 */
export default function DatesStep({ answers, set }) {
  const { start_date, end_date, voting_end_date } = answers;
  const orderInvalid = !!start_date && !!end_date && end_date <= start_date;
  const votingInvalid = !!end_date && !!voting_end_date && voting_end_date <= end_date;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            Start date <span className="text-destructive">*</span>
          </span>
          <input
            type="date"
            className="c53-input"
            min={today}
            value={start_date || ''}
            onChange={(e) => set('start_date', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            End date <span className="text-destructive">*</span>
          </span>
          <input
            type="date"
            className="c53-input"
            min={start_date || today}
            value={end_date || ''}
            onChange={(e) => set('end_date', e.target.value)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            Voting closes <span className="text-muted-foreground">(optional)</span>
          </span>
          <input
            type="date"
            className="c53-input"
            min={end_date || start_date || today}
            value={voting_end_date || ''}
            onChange={(e) => set('voting_end_date', e.target.value)}
          />
          <span className="mt-1.5 block text-xs text-muted-foreground">
            If the public votes, this is the last day they can. Leave blank and we'll suggest one.
          </span>
        </label>
      </div>
      {orderInvalid && (
        <p className="mt-3 text-sm font-medium text-destructive" role="alert">
          The end date must be after the start date.
        </p>
      )}
      {votingInvalid && (
        <p className="mt-3 text-sm font-medium text-destructive" role="alert">
          Voting must close after the end date.
        </p>
      )}
    </div>
  );
}
```

---

## WinnerPolicyStep.jsx

**File:** `src/components/host/apply/WinnerPolicyStep.jsx`

```jsx
/**
 * Fixed platform policy for how winners are decided. Hosts read it and confirm
 * they accept it — nothing here is configurable.
 */
import { Scale, Users, ShieldCheck, Stamp } from 'lucide-react';

const POINTS = [
  {
    icon: Scale,
    title: 'Weighted official score',
    body: 'Every finalist receives a qualified judge panel score and a verified public vote score. The official result combines both using the published weighting for the round.',
  },
  {
    icon: Users,
    title: 'Qualified, conflict-free judges',
    body: 'Judges are approved for the category they score and must complete a conflict-of-interest declaration before they can score any entry.',
  },
  {
    icon: ShieldCheck,
    title: 'Vote integrity review',
    body: 'Public votes are reviewed for abuse before results are calculated. Votes found to be invalid are never counted.',
  },
  {
    icon: Stamp,
    title: 'Results approval and sign-off',
    body: 'Results are approved internally, signed off by an independent scrutineer where required, and only then published. Hosts cannot change results after voting closes.',
  },
];

export default function WinnerPolicyStep({ accepted, onAccept }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Winners are decided by our standard, published selection process — it's the same for every challenge on the
        platform, so results stay fair and defensible.
      </p>

      {POINTS.map((p) => {
        const Icon = p.icon;
        return (
          <div key={p.title} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold">{p.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
            </div>
          </div>
        );
      })}

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-secondary/60 p-4">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[--primary]"
          checked={!!accepted}
          onChange={(e) => onAccept(e.target.checked)}
        />
        <span className="text-sm">
          I have read and accept the judging and results policy for my challenge, including the judge panel and public
          vote weighting, the integrity review, and the results approval process.
        </span>
      </label>
    </div>
  );
}
```

---

## ApplicationSubmitted.jsx

**File:** `src/components/host/apply/ApplicationSubmitted.jsx`

```jsx
/** Thank-you screen after a host application is sent — journey now at Review. */
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import OnboardingChecklist from '@/components/host/OnboardingChecklist';

export default function ApplicationSubmitted({ title }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-8 text-center sm:p-10">
      <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
        <CheckCircle2 className="h-9 w-9 text-success" aria-hidden="true" />
      </span>
      <h2 className="mt-6 font-heading text-3xl font-extrabold">Your application is in!</h2>
      <p className="mx-auto mt-4 max-w-md text-muted-foreground">
        Thanks{title ? ` for "${title}"` : ''} — our team is reviewing it now and we'll be in touch with
        the next step. You can follow its progress any time under "My challenges".
      </p>

      <div className="mx-auto mt-8 max-w-2xl text-left">
        <OnboardingChecklist currentStep={2} />
      </div>

      <Link
        to="/host-dashboard"
        className="mt-8 inline-flex rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white"
      >
        Go to my workspace
      </Link>
    </div>
  );
}
```

---

*End of Part 3. Continue to Part 4 for supporting components, hooks, shared logic, and entity schemas.*