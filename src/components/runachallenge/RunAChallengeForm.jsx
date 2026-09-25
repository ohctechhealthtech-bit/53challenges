import { useState, useRef, useEffect } from 'react';
import { Loader2, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { challengeApi } from '@/lib/challengeApi';
import { addAudienceMember } from '@/lib/marketing';
import { Section, Field, TextInput, TextArea, Select, MultiSelect, Checkbox } from '@/components/runachallenge/FormControls';
import { orderedTaxonomy } from '@/lib/taxonomy';
import EmailVerifyGate from '@/components/verify/EmailVerifyGate';

const ORG_TYPES = ['Sponsor/Brand', 'Government', 'Not-for-profit', 'School/University', 'Community Group', 'Corporate', 'Media/Publisher', 'Other'];
const GEO_SCOPES = ['Local', 'State', 'National', 'Global'];
const CONTACT_METHODS = ['Email', 'Phone', 'Zoom/Video Call', 'In Person'];
const DISCUSSION_TYPES = ['Sponsor a Challenge', 'Run a Challenge', 'Host a Competition', 'School Challenge Program', 'Awareness Campaign', 'Talent Discovery', 'Community Engagement', 'Brand Activation', 'Fundraiser', 'Co-Branded Challenge', 'Fully Managed by 53 Challenges', 'Other'];
const CHALLENGE_CATEGORIES = ['Art & Craft', 'Photography', 'Writing & Storytelling', 'Digital Creativity', 'Performance & Voice', 'Dance', 'Open/Experimental', 'STEM/Innovation', 'Community', 'Education', 'Other'];
const AGE_GROUPS = ['Kids', 'Teens', 'Adults', 'Open to All', 'School Students', 'University Students', 'Families', 'Other'];
const ENTRY_FORMATS = ['Photo', 'Video', 'Writing', 'Artwork', 'Audio', 'Live Performance', 'Mixed Format', 'Other'];
const CHALLENGE_MODES = ['Online', 'Offline', 'Hybrid'];
const SUPPORT_OPTIONS = ['Strategy/Planning', 'Challenge Setup', 'Submission Management', 'Judging Workflow', 'Voting Workflow', 'Marketing/Promotion', 'School Outreach', 'Prize Planning', 'Reporting/Analytics', 'End-to-End Management', 'Other'];
const INSTITUTION_TYPES = ['Primary School', 'Secondary School', 'University', 'Training Provider', 'Other'];
const HEAR_ABOUT = ['Google', 'Social Media', 'Referral', 'School/Organisation Network', 'Email', 'Event', 'Existing Partner', 'Other'];
const REWARD_OPTIONS = ['Cash prize pool', 'Products / merchandise', 'Mentorship or exposure', 'Internships / opportunities', "A mix - let's discuss"];

// Maps the free-form organisation_type label to the PartnerInquiry enum.
const ORG_KIND_MAP = {
  'Sponsor/Brand': 'sponsor',
  'Government': 'council',
  'Not-for-profit': 'other',
  'School/University': 'school',
  'Community Group': 'other',
  'Corporate': 'workplace',
  'Media/Publisher': 'other',
  'Other': 'other',
};

const EMPTY = {
  organisation_name: '', company_website: '', industry: '', contact_name: '',
  organisation_type: '', geographic_scope: '',
  contact_email: '', contact_phone: '', preferred_contact_method: '',
  discussion_subject: '', discussion_type: [], challenge_title: '',
  challenge_purpose: '', challenge_description: '',
  challenge_category: [], category_other: '', target_audience: '', age_group: '',
  entry_format: [], challenge_mode: '', event_location: '',
  support_needed: [], audience_size: '', estimated_budget: '', launch_timing: '',
  success_metrics: '', additional_notes: '', hear_about_us: '',
  consent_contact: false, consent_accuracy: false,
  institution_type: '', partner_expectations: '', reward_format: '',
};

export default function RunAChallengeForm({ onSuccess }) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const fileRef = useRef(null);
  // Proof the contact address was confirmed with an emailed code.
  const [emailToken, setEmailToken] = useState('');

  const set = (k, v) => {
    if (k === 'contact_email') setEmailToken('');
    setF((s) => ({ ...s, [k]: v }));
  };

  // New-challenge category picker (Prompt 14): sourced from the local
  // Subcategory taxonomy, filtered to active records via orderedTaxonomy()
  // so deactivating a Subcategory removes it from selection while existing
  // challenges that already use it keep rendering (they store the slug/name
  // as a plain string). Falls back to the static list if the taxonomy can't
  // be loaded. "Other" is always appended for the category_other escape hatch.
  const [categoryOptions, setCategoryOptions] = useState(CHALLENGE_CATEGORIES);
  useEffect(() => {
    let mounted = true;
    base44.entities.Subcategory.list('sort_order', 200)
      .then((subs) => {
        if (!mounted) return;
        const active = orderedTaxonomy(subs || []).map((s) => s.name);
        setCategoryOptions(active.length ? [...active, 'Other'] : CHALLENGE_CATEGORIES);
      })
      .catch(() => { /* keep static fallback */ });
    return () => { mounted = false; };
  }, []);

  // Focus the first invalid field after a failed validation pass.
  useEffect(() => {
    const keys = Object.keys(errors);
    if (keys.length === 0) return;
    const el = document.querySelector(`[data-field="${keys[0]}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = el.querySelector('input, textarea, select, button');
      if (input) input.focus();
    }
  }, [errors]);

  const validate = () => {
    const e = {};
    const req = (k, label) => {
      if (!f[k] || (Array.isArray(f[k]) && f[k].length === 0)) e[k] = `${label} is required.`;
    };
    req('organisation_name', 'Organisation name');
    req('contact_name', 'Contact name');
    req('organisation_type', 'Organisation type');
    req('geographic_scope', 'Geographic scope');
    req('contact_email', 'Contact email');
    req('discussion_subject', 'Discussion subject');
    req('discussion_type', 'Discussion type');
    req('challenge_title', 'Challenge title');
    req('challenge_purpose', 'Challenge objective');
    req('challenge_description', 'Challenge description');
    req('challenge_category', 'Challenge category');
    req('target_audience', 'Target audience');
    req('age_group', 'Age group');
    req('entry_format', 'Entry format');
    req('challenge_mode', 'Challenge mode');
    req('support_needed', 'Support needed');
    if (!f.consent_contact) e.consent_contact = 'Please agree to be contacted.';
    if (!f.consent_accuracy) e.consent_accuracy = 'Please confirm the information is accurate.';
    // Conditional requirements
    if (f.organisation_type === 'School/University' && !f.institution_type) e.institution_type = 'Institution type is required.';
    if ((f.challenge_mode === 'Offline' || f.challenge_mode === 'Hybrid') && !f.event_location) e.event_location = 'Event location is required.';
    if (f.discussion_type.includes('Co-Branded Challenge') && !f.partner_expectations) e.partner_expectations = 'Partner expectations are required.';
    if (f.challenge_category.includes('Other') && !f.category_other) e.category_other = 'Please specify the other category.';
    // Format checks
    if (f.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contact_email)) e.contact_email = 'Please enter a valid email.';
    else if (f.contact_email && !emailToken) e.contact_email = 'Please verify this email with the code we send you.';
    if (f.company_website && !/^https?:\/\/.+\..+/.test(f.company_website)) e.company_website = 'Please enter a valid URL (e.g. https://...).';
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError('Please complete all required fields.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      // Optional file upload — failure here is non-blocking.
      let attachment_url = '';
      if (fileRef.current?.files?.[0]) {
        try {
          const up = await base44.integrations.Core.UploadFile({ file: fileRef.current.files[0] });
          attachment_url = up.file_url || '';
        } catch { /* attachment is optional */ }
      }

      // Merge purpose + description into one field for the external API,
      // which only accepts a single description string.
      const mergedDescription = `Objective: ${f.challenge_purpose}\n\nDescription: ${f.challenge_description}`;

      // 1. Submit to the external Challenge API — preserve existing flow,
      //    including duplicate + error handling.
      const result = await challengeApi.submitSponsorApplication({
        organisation_name: f.organisation_name,
        contact_name: f.contact_name,
        contact_email: f.contact_email,
        challenge_title: f.challenge_title,
        challenge_description: mergedDescription,
        organisation_type: f.organisation_type,
        geographic_scope: f.geographic_scope,
        phone: f.contact_phone,
        audience: f.target_audience,
        audience_size: f.audience_size,
        estimated_budget: f.estimated_budget,
        launch_timing: f.launch_timing,
      });
      if (!result.success) {
        if (result.duplicate) {
          setError(result.error || 'An application from this email is already under review.');
        } else {
          setError(result.error || 'Could not submit inquiry.');
        }
        return;
      }

      // 2. Save all new fields into a local PartnerInquiry record.
      try {
        await base44.entities.PartnerInquiry.create({
          company_name: f.organisation_name,
          company_website: f.company_website,
          industry: f.industry,
          contact_name: f.contact_name,
          contact_email: f.contact_email,
          contact_phone: f.contact_phone,
          challenge_title: f.challenge_title,
          challenge_type: f.discussion_type.join(', '),
          challenge_goal: f.challenge_purpose,
          challenge_description: f.challenge_description,
          audience_description: f.target_audience,
          audience_size: f.audience_size,
          geographic_scope: f.geographic_scope,
          launch_timing: f.launch_timing,
          estimated_budget: f.estimated_budget,
          additional_notes: f.additional_notes,
          how_heard: f.hear_about_us,
          status: 'new',
          pipeline_status: 'new',
          organisation_kind: ORG_KIND_MAP[f.organisation_type] || 'other',
          ai_plan: {
            enquiry_source: 'Organisation Challenge Discussion Form',
            organisation_type: f.organisation_type,
            preferred_contact_method: f.preferred_contact_method,
            discussion_subject: f.discussion_subject,
            discussion_type: f.discussion_type,
            challenge_purpose: f.challenge_purpose,
            challenge_category: f.challenge_category,
            category_other: f.category_other,
            age_group: f.age_group,
            entry_format: f.entry_format,
            challenge_mode: f.challenge_mode,
            event_location: f.event_location,
            support_needed: f.support_needed,
            success_metrics: f.success_metrics,
            institution_type: f.institution_type,
            partner_expectations: f.partner_expectations,
            reward_format: f.reward_format,
            attachment_url,
          },
        });
      } catch { /* local record is secondary — API already succeeded */ }

      try { await addAudienceMember({ email: f.contact_email, name: f.contact_name, audience_type: 'sponsor', source: 'inquiry' }); } catch {}

      onSuccess();
    } catch (err) {
      setError(err?.message || 'Could not submit inquiry.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Section title="About your organisation" description="Tell us who you are.">
        <Field label="Organisation name" required error={errors.organisation_name} field="organisation_name">
          <TextInput value={f.organisation_name} onChange={(e) => set('organisation_name', e.target.value)} />
        </Field>
        <Field label="Website" error={errors.company_website} field="company_website">
          <TextInput type="url" placeholder="https://" value={f.company_website} onChange={(e) => set('company_website', e.target.value)} />
        </Field>
        <Field label="Industry" field="industry">
          <TextInput value={f.industry} onChange={(e) => set('industry', e.target.value)} />
        </Field>
        <Field label="Primary contact name" required error={errors.contact_name} field="contact_name">
          <TextInput value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} />
        </Field>
        <Field label="Organisation type" required error={errors.organisation_type} field="organisation_type">
          <Select options={ORG_TYPES} placeholder="Select…" value={f.organisation_type} onChange={(e) => set('organisation_type', e.target.value)} />
        </Field>
        <Field label="Geographic scope" required error={errors.geographic_scope} field="geographic_scope">
          <Select options={GEO_SCOPES} placeholder="Select…" value={f.geographic_scope} onChange={(e) => set('geographic_scope', e.target.value)} />
        </Field>
        {f.organisation_type === 'School/University' && (
          <Field label="Institution type" required error={errors.institution_type} field="institution_type">
            <Select options={INSTITUTION_TYPES} placeholder="Select…" value={f.institution_type} onChange={(e) => set('institution_type', e.target.value)} />
          </Field>
        )}
      </Section>

      <Section title="Contact" description="How can we reach you?">
        <Field label="Contact email" required error={errors.contact_email} field="contact_email">
          <TextInput type="email" value={f.contact_email} onChange={(e) => set('contact_email', e.target.value)} />
        </Field>
        <Field label="Phone" field="contact_phone">
          <TextInput value={f.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} />
        </Field>
        <Field label="Preferred contact method" field="preferred_contact_method">
          <Select options={CONTACT_METHODS} placeholder="Select…" value={f.preferred_contact_method} onChange={(e) => set('preferred_contact_method', e.target.value)} />
        </Field>
        {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contact_email.trim()) ? (
          <div className="sm:col-span-2">
            <EmailVerifyGate
              email={f.contact_email.trim()}
              purpose="host_application"
              label="your enquiry"
              verified={!!emailToken}
              onVerified={setEmailToken}
            />
          </div>
        ) : null}
      </Section>

      <Section title="Discussion overview" description="What would you like to discuss?">
        <Field label="Discussion subject" required error={errors.discussion_subject} full field="discussion_subject">
          <TextInput value={f.discussion_subject} onChange={(e) => set('discussion_subject', e.target.value)} placeholder="What would you like to discuss?" />
        </Field>
        <Field label="Discussion type" required error={errors.discussion_type} full field="discussion_type">
          <MultiSelect options={DISCUSSION_TYPES} values={f.discussion_type} onChange={(v) => set('discussion_type', v)} />
        </Field>
        <Field label="Challenge title" required error={errors.challenge_title} full field="challenge_title">
          <TextInput value={f.challenge_title} onChange={(e) => set('challenge_title', e.target.value)} />
        </Field>
        <Field label="Challenge objective" required error={errors.challenge_purpose} full field="challenge_purpose">
          <TextArea value={f.challenge_purpose} onChange={(e) => set('challenge_purpose', e.target.value)} />
        </Field>
        <Field label="Challenge description" required error={errors.challenge_description} full field="challenge_description">
          <TextArea value={f.challenge_description} onChange={(e) => set('challenge_description', e.target.value)} />
        </Field>
        {f.discussion_type.includes('Co-Branded Challenge') && (
          <Field label="Partner expectations" required error={errors.partner_expectations} full field="partner_expectations">
            <TextArea value={f.partner_expectations} onChange={(e) => set('partner_expectations', e.target.value)} />
          </Field>
        )}
      </Section>

      <Section title="Challenge setup" description="Define the challenge format.">
        <Field label="Challenge category" required error={errors.challenge_category} full field="challenge_category">
          <MultiSelect options={categoryOptions} values={f.challenge_category} onChange={(v) => set('challenge_category', v)} />
        </Field>
        {f.challenge_category.includes('Other') && (
          <Field label="Other category" required error={errors.category_other} full field="category_other">
            <TextInput value={f.category_other} onChange={(e) => set('category_other', e.target.value)} />
          </Field>
        )}
        <Field label="Target audience" required error={errors.target_audience} field="target_audience">
          <TextInput value={f.target_audience} onChange={(e) => set('target_audience', e.target.value)} />
        </Field>
        <Field label="Age group" required error={errors.age_group} field="age_group">
          <Select options={AGE_GROUPS} placeholder="Select…" value={f.age_group} onChange={(e) => set('age_group', e.target.value)} />
        </Field>
        <Field label="Entry format" required error={errors.entry_format} full field="entry_format">
          <MultiSelect options={ENTRY_FORMATS} values={f.entry_format} onChange={(v) => set('entry_format', v)} />
        </Field>
        <Field label="Challenge mode" required error={errors.challenge_mode} field="challenge_mode">
          <Select options={CHALLENGE_MODES} placeholder="Select…" value={f.challenge_mode} onChange={(e) => set('challenge_mode', e.target.value)} />
        </Field>
        {(f.challenge_mode === 'Offline' || f.challenge_mode === 'Hybrid') && (
          <Field label="Event location" required error={errors.event_location} field="event_location">
            <TextInput value={f.event_location} onChange={(e) => set('event_location', e.target.value)} />
          </Field>
        )}
      </Section>

      <Section title="Planning and support" description="What support do you need from us?">
        <Field label="Support needed" required error={errors.support_needed} full field="support_needed">
          <MultiSelect options={SUPPORT_OPTIONS} values={f.support_needed} onChange={(v) => set('support_needed', v)} />
        </Field>
        <Field label="Audience size" field="audience_size">
          <TextInput value={f.audience_size} onChange={(e) => set('audience_size', e.target.value)} placeholder="e.g. 500" />
        </Field>
        <Field label="Estimated budget" field="estimated_budget">
          <TextInput value={f.estimated_budget} onChange={(e) => set('estimated_budget', e.target.value)} placeholder="e.g. $10k" />
        </Field>
        <Field label="Launch timing" field="launch_timing">
          <TextInput value={f.launch_timing} onChange={(e) => set('launch_timing', e.target.value)} placeholder="e.g. Term 3 2026" />
        </Field>
        <Field label="How will winners be rewarded?" field="reward_format">
          <Select options={REWARD_OPTIONS} placeholder="Select…" value={f.reward_format} onChange={(e) => set('reward_format', e.target.value)} />
        </Field>
        <Field label="Success metrics" full field="success_metrics">
          <TextArea value={f.success_metrics} onChange={(e) => set('success_metrics', e.target.value)} />
        </Field>
      </Section>

      <Section title="Additional details" description="Anything else we should know?">
        <Field label="Attachments" full field="attachments">
          <input
            ref={fileRef}
            type="file"
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
          />
        </Field>
        <Field label="Additional notes" full field="additional_notes">
          <TextArea value={f.additional_notes} onChange={(e) => set('additional_notes', e.target.value)} />
        </Field>
        <Field label="How did you hear about us?" field="hear_about_us">
          <Select options={HEAR_ABOUT} placeholder="Select…" value={f.hear_about_us} onChange={(e) => set('hear_about_us', e.target.value)} />
        </Field>
      </Section>

      <Section title="Consent" description="Please confirm to submit.">
        <div className="space-y-3 sm:col-span-2">
          <Checkbox label="I agree to be contacted about this enquiry and accept the privacy policy." required checked={f.consent_contact} onChange={(v) => set('consent_contact', v)} error={errors.consent_contact} />
          <Checkbox label="I confirm the information provided is accurate." required checked={f.consent_accuracy} onChange={(v) => set('consent_accuracy', v)} error={errors.consent_accuracy} />
        </div>
      </Section>

      {error && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">{error}</p>}
      <button
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl grad-bg px-7 py-3.5 text-sm font-bold text-white btn-glow disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit inquiry
      </button>
    </form>
  );
}