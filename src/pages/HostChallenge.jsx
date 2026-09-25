import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Globe, Phone, Mail, User, Sparkles, DollarSign, Users, MapPin,
  Calendar, Loader2, CheckCircle2, ArrowLeft, Target, Award, MessageSquare, Megaphone,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { challengeApi } from '@/lib/challengeApi';
import EmailVerifyGate from '@/components/verify/EmailVerifyGate';

import {
  INDUSTRIES, CHALLENGE_TYPES, GOALS, AUDIENCE_SIZES, SCOPES, TIMINGS, BUDGETS, PRIZES, HOW_HEARD,
} from '@/lib/hostRequestOptions';

export default function HostChallenge() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    company_name: '', company_website: '', industry: '',
    contact_name: '', contact_email: '', contact_phone: '',
    challenge_title: '', challenge_type: '', challenge_goal: '', challenge_description: '',
    audience_description: '', audience_size: '', geographic_scope: '',
    launch_timing: '', start_date: '', end_date: '', estimated_budget: '', prize_format: '',
    additional_notes: '', how_heard: '', abn: '', consent_contact: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  // Proof the contact address was confirmed with an emailed code.
  const [emailToken, setEmailToken] = useState('');

  const set = (k) => (e) => {
    if (k === 'contact_email') setEmailToken('');
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const required = ['company_name', 'contact_name', 'contact_email', 'challenge_title', 'challenge_description', 'audience_description', 'start_date', 'end_date'];
    const missing = required.filter((k) => !form[k]?.trim());
    if (missing.length) { setError('Please complete all required fields.'); return; }
    if (form.end_date <= form.start_date) { setError('The end date must be after the start date.'); return; }
    if (!form.consent_contact) { setError('Please agree to be contacted and accept the privacy policy.'); return; }
    if (!emailToken) { setError('Please verify your contact email with the code we send you.'); return; }
    setSubmitting(true);
    try {
      await challengeApi.hostChallengeRequest(form, user?.email || '', emailToken);
      setSubmitted(true);
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="container-tight py-24">
        <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card/60 p-10 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
          <h1 className="mt-5 font-heading text-3xl font-extrabold">Proposal received!</h1>
          <p className="mt-3 text-muted-foreground">
            Thanks, {form.contact_name.split(' ')[0] || 'there'}. Our partnerships team will review the details and reach out to <span className="text-foreground">{form.contact_email}</span> within 2 business days with next steps.
          </p>
          <Link to="/" className="mt-8 inline-flex items-center gap-2 rounded-xl grad-bg px-6 py-3 text-sm font-bold text-white">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <section className="relative overflow-hidden gradient-hero border-b border-border">
        <div className="container-tight py-14">
          <Link to="/" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 text-accent" /> For Brands & Partners
          </div>
          <h1 className="mt-4 font-heading text-4xl font-extrabold sm:text-5xl">
            Host a <span className="grad-text">challenge</span> with us
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            The more we know up front, the more useful our first conversation will be. Share the details below and we'll come back with a tailored proposal.
          </p>
        </div>
      </section>

      <section className="container-tight py-12">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-10">
          {/* About the company */}
          <Group title="About your organisation" subtitle="Who you are and how to reach you.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field icon={Building2} label="Company / organisation name" required>
                <input className="c53-input" value={form.company_name} onChange={set('company_name')} placeholder="Acme Co." required />
              </Field>
              <Field icon={Globe} label="Website (optional)">
                <input className="c53-input" value={form.company_website} onChange={set('company_website')} placeholder="acme.co" />
              </Field>
              <Field icon={Building2} label="Industry / sector">
                <Select className="c53-input" value={form.industry} onChange={set('industry')} options={INDUSTRIES} placeholder="Select an industry" />
              </Field>
              <Field icon={Building2} label="ABN / business number (optional)">
                <input className="c53-input" value={form.abn} onChange={set('abn')} placeholder="12 345 678 901" />
              </Field>
              <Field icon={User} label="Primary contact name" required>
                <input className="c53-input" value={form.contact_name} onChange={set('contact_name')} placeholder="Jane Doe" required />
              </Field>
              <Field icon={Mail} label="Contact email" required>
                <input type="email" className="c53-input" value={form.contact_email} onChange={set('contact_email')} placeholder="jane@acme.co" required />
              </Field>
              <Field icon={Phone} label="Phone (optional)">
                <input className="c53-input" value={form.contact_phone} onChange={set('contact_phone')} placeholder="04xx xxx xxx" />
              </Field>
              {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim()) ? (
                <div className="sm:col-span-2">
                  <EmailVerifyGate
                    email={form.contact_email.trim()}
                    purpose="host_application"
                    label="your proposal"
                    verified={!!emailToken}
                    onVerified={setEmailToken}
                  />
                </div>
              ) : null}
            </div>
          </Group>

          {/* About the challenge */}
          <Group title="The challenge" subtitle="What you want to run and why.">
            <div className="grid gap-5">
              <Field icon={Sparkles} label="Working title or theme" required>
                <input className="c53-input" value={form.challenge_title} onChange={set('challenge_title')} placeholder="e.g. 'Design a sustainable packaging concept'" required />
              </Field>
              <Field icon={Target} label="Type of challenge" required>
                <Select className="c53-input" value={form.challenge_type} onChange={set('challenge_type')} options={CHALLENGE_TYPES} placeholder="Select a discipline" />
              </Field>
              <Field icon={Sparkles} label="What's the main goal?">
                <Select className="c53-input" value={form.challenge_goal} onChange={set('challenge_goal')} options={GOALS} placeholder="Select a goal" />
              </Field>
              <Field icon={MessageSquare} label="Describe the challenge you have in mind" required>
                <textarea className="c53-input min-h-[140px] resize-y" value={form.challenge_description} onChange={set('challenge_description')} placeholder="What should participants do? What does great work look like? Any formats (visual, writing, video)?" required />
              </Field>
            </div>
          </Group>

          {/* Audience & scope */}
          <Group title="Who & where" subtitle="Who should enter and how far it reaches.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field icon={Users} label="Who should participate?" required>
                <input className="c53-input" value={form.audience_description} onChange={set('audience_description')} placeholder="e.g. NSW high-school students, emerging photographers" required />
              </Field>
              <Field icon={Users} label="Expected number of participants">
                <Select className="c53-input" value={form.audience_size} onChange={set('audience_size')} options={AUDIENCE_SIZES} placeholder="Select a range" />
              </Field>
              <Field icon={MapPin} label="Geographic scope">
                <Select className="c53-input" value={form.geographic_scope} onChange={set('geographic_scope')} options={SCOPES} placeholder="Select a scope" />
              </Field>
              <Field icon={Calendar} label="When do you want to launch?">
                <Select className="c53-input" value={form.launch_timing} onChange={set('launch_timing')} options={TIMINGS} placeholder="Select a timeframe" />
              </Field>
              <Field icon={Calendar} label="Challenge start date" required>
                <input type="date" className="c53-input" value={form.start_date} onChange={set('start_date')} required />
              </Field>
              <Field icon={Calendar} label="Challenge end date" required>
                <input type="date" className="c53-input" min={form.start_date || undefined} value={form.end_date} onChange={set('end_date')} required />
              </Field>
              {form.start_date && form.end_date && form.end_date <= form.start_date && (
                <p className="sm:col-span-2 text-sm font-medium text-destructive" role="alert">
                  The end date must be after the start date.
                </p>
              )}
            </div>
          </Group>

          {/* Budget & prizes */}
          <Group title="Budget & prizes" subtitle="Helps us scope realistic rewards and production.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field icon={DollarSign} label="Estimated budget">
                <Select className="c53-input" value={form.estimated_budget} onChange={set('estimated_budget')} options={BUDGETS} placeholder="Select a range" />
              </Field>
              <Field icon={Award} label="How will winners be rewarded?">
                <Select className="c53-input" value={form.prize_format} onChange={set('prize_format')} options={PRIZES} placeholder="Select a prize format" />
              </Field>
            </div>
          </Group>

          {/* Anything else */}
          <Group title="Anything else?" subtitle="Context that helps us come prepared.">
            <div className="grid gap-5">
              <Field icon={MessageSquare} label="Additional notes (optional)">
                <textarea className="c53-input min-h-[100px] resize-y" value={form.additional_notes} onChange={set('additional_notes')} placeholder="Known partners, sponsors, must-haves, dates to avoid, anything else." />
              </Field>
              <Field icon={Megaphone} label="How did you hear about us?">
                <Select className="c53-input" value={form.how_heard} onChange={set('how_heard')} options={HOW_HEARD} placeholder="Select a source" />
              </Field>
            </div>
          </Group>

          <div className="rounded-3xl border border-border bg-card/60 p-6">
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.consent_contact}
                onChange={(e) => setForm((f) => ({ ...f, consent_contact: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
              />
              <span>I agree to be contacted about this enquiry and accept the <Link to="/privacy-policy" className="text-primary underline">privacy policy</Link>. <span className="text-destructive">*</span></span>
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-bg px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <>Send proposal</>}
          </button>
        </form>
      </section>
    </div>
  );
}

function Group({ title, subtitle, children }) {
  return (
    <div className="rounded-3xl border border-border bg-card/60 p-6 sm:p-8">
      <h2 className="font-heading text-xl font-bold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Field({ icon: Icon, label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" /> {label}{required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <select className="c53-input" value={value} onChange={onChange}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}