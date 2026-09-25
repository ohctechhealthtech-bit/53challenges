import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, Loader2, CheckCircle2, ShieldCheck, Users, UploadCloud, X, FileText, Film, Image as ImageIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { challengeApi } from '@/lib/challengeApi';
import {
  JUDGE_APPLICATION_CATEGORIES, JUDGE_STATES, JUDGE_AVAILABILITY,
} from '@/lib/judges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import EmailVerifyGate from '@/components/verify/EmailVerifyGate';

export default function BecomeJudge() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', state: '', categories: [], experience: '', availability: [],
    current_role: '', organisation: '', years_experience: '', previous_judging_experience: '',
    portfolio_url: '', supporting_links: '', conflict_of_interest: '', consent_fair_judging: false, consent_contact: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [uploads, setUploads] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [emailToken, setEmailToken] = useState('');

  const setField = (k, v) => {
    if (k === 'email') setEmailToken('');
    setForm((f) => ({ ...f, [k]: v }));
  };

  const toggleCategory = (cat) => {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter((c) => c !== cat)
        : [...f.categories, cat],
    }));
  };

  const toggleAvailability = (a) => {
    setForm((f) => ({
      ...f,
      availability: f.availability.includes(a)
        ? f.availability.filter((x) => x !== a)
        : [...f.availability, a],
    }));
  };

  const MAX_UPLOADS = 5;
  const MAX_UPLOAD_MB = 100;

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    if (uploads.length + files.length > MAX_UPLOADS) {
      setErrors((er) => ({ ...er, uploads: 'You can attach up to ' + MAX_UPLOADS + ' files.' }));
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_UPLOAD_MB * 1024 * 1024);
    if (tooBig) {
      setErrors((er) => ({ ...er, uploads: tooBig.name + ' is larger than ' + MAX_UPLOAD_MB + 'MB.' }));
      return;
    }
    setErrors((er) => ({ ...er, uploads: undefined }));
    setUploading(true);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setUploads((u) => [...u, { name: file.name, url: file_url, size: file.size, type: file.type }]);
      }
    } catch {
      setErrors((er) => ({ ...er, uploads: 'Upload failed. Please try again.' }));
    } finally {
      setUploading(false);
    }
  };

  const removeUpload = (url) => setUploads((u) => u.filter((f) => f.url !== url));

  const submit = async (e) => {
    e.preventDefault();
    if (uploading) { setError('Please wait for file uploads to finish.'); return; }
    setError('');
    const errs = {};
    if (!form.name.trim()) errs.name = 'Full name is required.';
    if (!form.email.trim()) errs.email = 'Email is required.';
    if (!form.phone.trim()) errs.phone = 'Phone number is required.';
    if (!form.state) errs.state = 'State is required.';
    if (form.categories.length === 0) errs.categories = 'Select at least one area of expertise.';
    if (!form.current_role.trim()) errs.current_role = 'Current role / profession is required.';
    if (!form.years_experience) errs.years_experience = 'Years of experience is required.';
    if (!form.experience.trim()) errs.experience = 'Please describe your relevant experience.';
    if (uploads.length === 0) errs.uploads = 'Please attach at least one piece of supporting material.';
    if (!form.consent_fair_judging) errs.consent_fair_judging = 'Please confirm the declaration.';
    if (!form.consent_contact) errs.consent_contact = 'Please agree to be contacted.';
    if (!emailToken) errs.email_verification = 'Please verify your email address with the code we send you.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError('Please complete all required fields.');
      return;
    }
    setSubmitting(true);
    try {
      // 1. Submit to the external Challenge API — sends confirmation email,
      //    enforces one-open-application-per-email, and returns application_id.
      const result = await challengeApi.submitJudgeApplication({
        full_name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        state: form.state,
        categories: form.categories,
        experience: form.experience.trim(),
        availability: form.availability,
        current_role: form.current_role.trim(),
        organisation: form.organisation.trim(),
        years_experience: form.years_experience,
        previous_judging_experience: form.previous_judging_experience.trim(),
        portfolio_url: form.portfolio_url.trim(),
        conflict_of_interest: form.conflict_of_interest.trim(),
        supporting_links: form.supporting_links.trim(),
        supporting_files: uploads.map((f) => ({ name: f.name, url: f.url })),
        // Attached supporting material is submitted as the applicant's works.
        works: uploads.map((f) => ({
          name: f.name,
          title: f.name,
          url: f.url,
          file_url: f.url,
          work_url: f.url,
          type: f.type || 'document',
          work_type: (f.type || '').indexOf('video/') === 0 ? 'video'
            : (f.type || '').indexOf('image/') === 0 ? 'image' : 'document',
          description: 'Supporting material submitted with judge application',
        })),
      });
      if (!result.success) {
        if (result.duplicate) {
          setError(result.error || 'An application from this email is already under review.');
        } else {
          setError(result.error || 'Something went wrong. Please try again.');
        }
        return;
      }
      // 2. Also create a local JudgeProfile so the admin dashboard can track
      //    the applicant alongside existing internal workflows.
      try {
        await base44.entities.JudgeProfile.create({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          state: form.state,
          applied_categories: form.categories,
          approved_categories: [],
          experience: form.experience.trim(),
          availability: form.availability.join(', '),
          wwcc_status: 'none',
          agreement_signed: false,
          conflict_of_interest: form.conflict_of_interest ? [form.conflict_of_interest.trim()] : [],
          status: 'applicant',
        });
      } catch { /* local record is secondary — API already succeeded */ }
      setDone(true);
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="container-tight py-20">
        <div className="mx-auto max-w-lg rounded-3xl border border-border bg-card p-10 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
          <h1 className="mt-5 font-heading text-3xl font-extrabold">Application received</h1>
          <p className="mt-3 text-muted-foreground">
            Thanks {form.name.split(' ')[0]}! Our team reviews every judge application. We'll be in touch by email once your expertise and availability have been reviewed.
          </p>
          <Button className="mt-6" onClick={() => {
            setDone(false);
            setErrors({});
            setUploads([]);
            setEmailToken('');
            setForm({
              name: '', email: '', phone: '', state: '', categories: [], experience: '', availability: [],
              current_role: '', organisation: '', years_experience: '', previous_judging_experience: '',
              portfolio_url: '', supporting_links: '', conflict_of_interest: '', consent_fair_judging: false, consent_contact: false,
            });
          }}>
            Submit another application
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-tight py-14">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary"><Gavel className="h-6 w-6" /></span>
          <div>
            <h1 className="font-heading text-3xl font-extrabold">Become a Judge</h1>
            <p className="text-sm text-muted-foreground">Help us discover Australia's best creative talent.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <InfoCard icon={Users} title="Shape the platform" text="Your expertise decides who rises." />
          <InfoCard icon={ShieldCheck} title="Independent & fair" text="Conflict-of-interest declarations keep judging clean." />
          <InfoCard icon={Gavel} title="Real recognition" text="Judging credits appear across the 53 family." />
        </div>

        <form onSubmit={submit} className="mt-8 space-y-6 rounded-3xl border border-border bg-card p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Full name *</Label>
              <Input id="name" className="mt-1.5" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Jane Citizen" />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" className="mt-1.5" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="jane@example.com" />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="phone">Phone *</Label>
            <Input id="phone" className="mt-1.5" value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="0412 345 678" />
            {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
          </div>

          <div>
            <Label>State *</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {JUDGE_STATES.map((s) => (
                <button type="button" key={s} onClick={() => setField('state', s)}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${form.state === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white/5 hover:bg-muted'}`}>
                  {s}
                </button>
              ))}
            </div>
            {errors.state && <p className="mt-1 text-xs text-destructive">{errors.state}</p>}
          </div>

          <div>
            <Label>Category expertise *</Label>
            <p className="mb-2 text-xs text-muted-foreground">Select all that apply.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {JUDGE_APPLICATION_CATEGORIES.map((cat) => (
                <button type="button" key={cat.slug} onClick={() => toggleCategory(cat.slug)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${form.categories.includes(cat.slug) ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white/5 hover:bg-muted'}`}>
                  <span className={`grid h-5 w-5 place-items-center rounded-md border ${form.categories.includes(cat.slug) ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
                    {form.categories.includes(cat.slug) ? '✓' : ''}
                  </span>
                  {cat.label}
                </button>
              ))}
            </div>
            {errors.categories && <p className="mt-1 text-xs text-destructive">{errors.categories}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="current_role">Current role / profession *</Label>
              <Input id="current_role" className="mt-1.5" value={form.current_role} onChange={(e) => setField('current_role', e.target.value)} placeholder="e.g. Creative Director" />
              {errors.current_role && <p className="mt-1 text-xs text-destructive">{errors.current_role}</p>}
            </div>
            <div>
              <Label htmlFor="organisation">Organisation / employer <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="organisation" className="mt-1.5" value={form.organisation} onChange={(e) => setField('organisation', e.target.value)} placeholder="e.g. ACME Studios" />
            </div>
          </div>

          <div>
            <Label htmlFor="years_experience">Years of experience in your field *</Label>
            <select id="years_experience" className="c53-input mt-1.5" value={form.years_experience} onChange={(e) => setField('years_experience', e.target.value)}>
              <option value="">Select…</option>
              <option value="Under 2 years">Under 2 years</option>
              <option value="2-5 years">2-5 years</option>
              <option value="5-10 years">5-10 years</option>
              <option value="10+ years">10+ years</option>
            </select>
            {errors.years_experience && <p className="mt-1 text-xs text-destructive">{errors.years_experience}</p>}
          </div>

          <div>
            <Label htmlFor="experience">Describe your relevant experience *</Label>
            <Textarea id="experience" className="mt-1.5" rows={5} value={form.experience}
              onChange={(e) => setField('experience', e.target.value)}
              placeholder="Tell us about your background, notable work, and why you would be a great judge" />
            {errors.experience && <p className="mt-1 text-xs text-destructive">{errors.experience}</p>}
          </div>

          <div>
            <Label htmlFor="previous_judging">Previous judging or mentoring experience <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea id="previous_judging" className="mt-1.5" rows={3} value={form.previous_judging_experience}
              onChange={(e) => setField('previous_judging_experience', e.target.value)}
              placeholder="Awards judged, panels sat on, mentoring programs…" />
          </div>

          <div>
            <Label htmlFor="portfolio_url">Portfolio / website / LinkedIn URL <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="portfolio_url" type="url" className="mt-1.5" value={form.portfolio_url} onChange={(e) => setField('portfolio_url', e.target.value)} placeholder="https://" />
          </div>

          {/* Supporting material */}
          <div>
            <Label>Supporting material *</Label>
            <p className="mb-2 text-xs text-muted-foreground">Attach at least one file (up to 5) — video, images or documents (max 100MB each). These are submitted as your work.</p>
            <label className={'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-white/5 px-6 py-8 text-center transition hover:border-primary/60 hover:bg-primary/5 ' + (uploading ? 'pointer-events-none opacity-60' : '')}>
              <UploadCloud className="h-8 w-8 text-primary" />
              <span className="text-sm font-semibold">{uploading ? 'Uploading…' : 'Click to upload a video, image or document'}</span>
              <span className="text-xs text-muted-foreground">MP4, MOV, JPG, PNG, PDF, DOC, PPT — up to 100MB each</span>
              <input type="file" multiple className="hidden" accept="video/*,image/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.txt,.rtf" onChange={handleFiles} disabled={uploading} />
            </label>
            {uploads.length > 0 && (
              <ul className="mt-3 space-y-2">
                {uploads.map((f) => (
                  <li key={f.url} className="flex items-center gap-3 rounded-xl border border-border bg-white/5 px-4 py-2.5 text-sm">
                    {f.type && f.type.indexOf('video/') === 0 ? <Film className="h-4 w-4 shrink-0 text-primary" /> : f.type && f.type.indexOf('image/') === 0 ? <ImageIcon className="h-4 w-4 shrink-0 text-primary" /> : <FileText className="h-4 w-4 shrink-0 text-primary" />}
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button type="button" onClick={() => removeUpload(f.url)} className="shrink-0 text-muted-foreground transition hover:text-destructive" aria-label={'Remove ' + f.name}>
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {errors.uploads && <p className="mt-1 text-xs text-destructive">{errors.uploads}</p>}
          </div>

          <div>
            <Label htmlFor="supporting_links">Supporting links <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea id="supporting_links" className="mt-1.5" rows={2} value={form.supporting_links}
              onChange={(e) => setField('supporting_links', e.target.value)}
              placeholder="YouTube, Vimeo, Google Drive or portfolio links — one per line" />
          </div>

          <div>
            <Label>Availability</Label>
            <p className="mb-2 text-xs text-muted-foreground">Select all that apply.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {JUDGE_AVAILABILITY.map((a) => (
                <button type="button" key={a.slug} onClick={() => toggleAvailability(a.slug)}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${form.availability.includes(a.slug) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white/5 hover:bg-muted'}`}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conflict of interest */}
          <div className="rounded-2xl border border-border bg-white/5 p-5">
            <h2 className="font-heading text-lg font-bold">Conflict of interest</h2>
            <p className="mt-1 text-sm text-muted-foreground">We require all judges to act independently and fairly.</p>
            <div className="mt-4">
              <Label htmlFor="coi">Declare any conflicts of interest <span className="text-muted-foreground">(leave blank if none)</span></Label>
              <Textarea id="coi" className="mt-1.5" rows={3} value={form.conflict_of_interest}
                onChange={(e) => setField('conflict_of_interest', e.target.value)}
                placeholder="e.g. I have a family member entering in the Photography category…" />
            </div>
            <label className="mt-4 flex items-start gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.consent_fair_judging}
                onChange={(e) => setField('consent_fair_judging', e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
              />
              <span>I confirm I will declare any conflicts of interest and judge fairly and independently. <span className="text-destructive">*</span></span>
            </label>
            {errors.consent_fair_judging && <p className="mt-1 text-xs text-destructive">{errors.consent_fair_judging}</p>}
          </div>

          {/* Consent */}
          <label className="flex items-start gap-2.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.consent_contact}
              onChange={(e) => setField('consent_contact', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
            />
            <span>I agree to be contacted about judging opportunities and accept the <Link to="/privacy-policy" className="text-primary underline">privacy policy</Link>. <span className="text-destructive">*</span></span>
          </label>
          {errors.consent_contact && <p className="mt-1 text-xs text-destructive">{errors.consent_contact}</p>}

          <div>
            <EmailVerifyGate
              email={form.email.trim()}
              purpose="judge_application"
              label="your application"
              verified={!!emailToken}
              onVerified={setEmailToken}
            />
            {errors.email_verification && <p className="mt-1 text-xs text-destructive">{errors.email_verification}</p>}
          </div>

          {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={submitting || uploading} className="w-full grad-bg text-white">
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</> : 'Submit application'}
          </Button>
        </form>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, text }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-2 text-sm font-bold">{title}</p>
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}