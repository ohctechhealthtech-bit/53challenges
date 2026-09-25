# /host-apply — Part 2: Wizard Model, Screen Router & Shell

This is part 2. See also:
- `HOST_APPLY_PART1_API_PAGE.md` — API reference & page
- `HOST_APPLY_PART3_STEPS.md` — All step components
- `HOST_APPLY_PART4_SUPPORT.md` — Supporting components, hooks, shared logic, entities

---

## Wizard Model — applyWizardModel.js

**File:** `src/lib/applyWizardModel.js`

```javascript
/**
 * The /host-apply wizard model.
 *
 * buildScreens() returns the screens for the answers so far — conditional
 * screens are added and removed, so the total is always calculated and never
 * hard-coded. validateQuestion() validates one screen at a time and names the
 * field each message belongs to.
 */

// The seven phases shown in the progress bar.
export const PHASES = [
  { key: 'package', label: 'Your package' },
  { key: 'about', label: 'About you' },
  { key: 'challenge', label: 'Your challenge' },
  { key: 'details', label: 'Challenge details' },
  { key: 'judging', label: 'Judging' },
  { key: 'format', label: 'Format' },
  { key: 'payment', label: 'Payment' },
];

/** Age divisions come from the single "Who is this for?" answer. */
export function divisionsForAudience(audience) {
  switch (audience) {
    case 'under_13': return ['children'];
    case 'ages_13_to_17': return ['teens'];
    case 'adults_18_plus': return ['adults'];
    case 'seniors_65_plus': return ['adults'];
    case 'all_ages': return ['children', 'teens', 'adults'];
    default: return [];
  }
}

/** A judge panel is only needed when judges score the entries. */
export const usesJudgePanel = (winnerMethod) => winnerMethod === 'judges' || winnerMethod === 'combination';

export const isSeriesScope = (scope) => scope === 'series' || scope === 'annual_program';

export function buildScreens(answers = {}, ctx = {}) {
  const { packagePreselected = false, isAuthenticated = false } = ctx;
  const series = isSeriesScope(answers.program_scope);
  const screens = [];

  if (!packagePreselected) {
    screens.push({
      key: 'delivery_level', phase: 'package',
      question: 'How much help would you like from us?',
      hint: 'All packages run on the same platform — the difference is who does the work.',
    });
  }

  screens.push({
    key: 'host_type', phase: 'about',
    question: 'Who are you running this challenge for?',
    hint: 'This helps us tailor everything that follows.',
  });

  screens.push(
    { key: 'challenge_kind', phase: 'challenge', question: 'What kind of challenge would you like to run?', hint: "Pick the area that fits best — we'll guide you from there." },
    { key: 'activity_format', phase: 'challenge', question: 'What kind of activity is this?', hint: 'How would you like people to take part?' },
    { key: 'audience', phase: 'challenge', question: 'Who is this for?', hint: "We'll set the age groups for your challenge from this." },
    { key: 'setting', phase: 'challenge', question: 'Where will this take place?' },
    { key: 'template', phase: 'challenge', question: 'Here are the challenges that fit best', hint: 'Pick the one you like — you can still adjust the name and wording later.' },
  );

  if (!answers.category) {
    screens.push({ key: 'category', phase: 'details', question: 'What kind of entries are you after?' });
  }

  screens.push({
    key: 'participant_range', phase: 'details',
    question: 'How many people do you expect to take part?',
    hint: 'A rough guess is fine — we can adjust later.',
  });

  screens.push({
    key: 'winner_method', phase: 'judging',
    question: 'How winners are decided',
    hint: 'Our selection process is fixed for every challenge — please confirm you accept it.',
  });

  {
    screens.push({
      key: 'judges', phase: 'judging',
      question: 'Who should judge the entries?',
      hint: 'Use our judges, or nominate your own — we invite them for you.',
    });
  }

  screens.push({ key: 'program_scope', phase: 'format', question: 'Is this a one-off, or something ongoing?' });
  if (series) {
    screens.push(
      { key: 'series_count', phase: 'format', question: 'How many challenges should the series run?', hint: "We'll create them all automatically once you're approved." },
      { key: 'series_cadence', phase: 'format', question: 'How often should they run?' },
    );
  }
  screens.push({
    key: 'dates', phase: 'format',
    question: 'When does your challenge run?',
    hint: 'Entries open on your start date and close on your end date.',
  });

  screens.push({
    key: 'addons', phase: 'format',
    question: 'Would you like us to take care of anything else?',
    hint: 'Add any of these services now, or skip and decide later.',
  });

  // Guests give us their contact details first, then verify, then pay.
  if (!isAuthenticated) {
    screens.push({
      key: 'guest_submit', phase: 'payment',
      question: 'Last step — who should we reply to?',
      hint: "We'll set up your host account against these details and email them to you.",
    });
  }

  // Email verification gate — sits between details and payment so the email
  // is confirmed before any money is taken.
  screens.push({
    key: 'email_verify', phase: 'payment',
    question: 'Verify your email before sending your application',
    hint: 'We email a one-time code to confirm it's really you.',
    hideNext: true,
  });

  screens.push({
    key: 'payment', phase: 'payment',
    question: 'Confirm and pay',
    hint: 'Have a quick look over the costs, then send it — payment happens right here.',
    hideNext: true,
  });

  return screens;
}

const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
const filled = (v, min = 2) => String(v || '').trim().length >= min;

/** Validates a single screen. Returns [] when the screen is complete. */
export function validateQuestion(key, answers = {}, ctx = {}) {
  const a = answers;
  const errors = [];
  const add = (field, message) => errors.push({ field, message });

  switch (key) {
    case 'delivery_level':
      if (!a.delivery_level) add('delivery_level', 'Please choose how much help you would like.');
      break;

    case 'host_type': {
      if (!a.host_type) add('host_type', 'Please tell us who you are running this challenge for.');
      if (ctx.needsHostDetails) {
        if (!filled(a.org_name)) add('org_name', 'Organisation, school or group name is required.');
        if (!filled(a.contact_name)) add('contact_name', 'Your name is required.');
        if (!looksLikeEmail(a.org_contact_email)) add('org_contact_email', 'Please enter a valid contact email.');
      }
      if (!a.beneficiary_for) add('beneficiary_for', 'Please tell us who this challenge is being organised for.');
      if (a.beneficiary_for === 'other') {
        if (!filled(a.beneficiary_name)) add('beneficiary_name', 'Organisation or group name is required.');
        if (!filled(a.beneficiary_contact_name)) add('beneficiary_contact_name', 'Contact person is required.');
        if (!looksLikeEmail(a.beneficiary_contact_email)) add('beneficiary_contact_email', 'Please enter a valid contact email for them.');
      }
      break;
    }

    case 'challenge_kind':
      if (!a.category) add('challenge_kind', 'Please choose the kind of challenge you would like to run.');
      break;
    case 'activity_format':
      if (!a.discovery_format) add('activity_format', 'Please choose the kind of activity.');
      break;
    case 'audience':
      if (!a.discovery_age) add('audience', 'Please tell us who this challenge is for.');
      break;
    case 'setting':
      if (!a.discovery_setting) add('setting', 'Please tell us where this will take place.');
      break;

    case 'template':
      if (!a.template_id) {
        if (!a.custom_challenge_idea) {
          add('template_id', 'Choose a challenge, or tell us you would like your own.');
          break;
        }
        if (!filled(a.challenge_title, 3)) add('challenge_title', 'Challenge name needs at least 3 characters.');
        if (String(a.challenge_title || '').length > 80) add('challenge_title', 'Challenge name can be at most 80 characters.');
        if (!a.category) add('category', 'Please choose a category for your challenge.');
        if (!filled(a.challenge_description, 1)) add('challenge_description', 'Please describe what people should create.');
        if (String(a.challenge_description || '').length > 500) add('challenge_description', 'Description can be at most 500 characters.');
      }
      break;

    case 'category':
      if (!a.category) add('category', 'Please choose the kind of entries you are after.');
      break;
    case 'participant_range':
      if (!a.participant_range) add('participant_range', 'Please give us a rough number of participants.');
      break;

    case 'winner_method':
      if (!a.judging_policy_accepted) add('judging_policy_accepted', 'Please confirm you accept the judging and results policy.');
      break;

    case 'judges': {
      const source = a.judge_source || 'platform';
      if (!source) add('judge_source', 'Please tell us who should judge the entries.');
      if (source !== 'platform') {
        const ok = (a.host_judges || []).some((j) => filled(j.name) && looksLikeEmail(j.email));
        if (!ok) add('host_judges', 'Add at least one judge with a name and a valid email address.');
      }
      break;
    }

    case 'program_scope':
      if (!a.program_scope) add('program_scope', 'Please tell us if this is a one-off or ongoing.');
      break;
    case 'series_count':
      if (!a.series_count) add('series_count', 'Please choose how many challenges the series runs.');
      break;
    case 'series_cadence':
      if (!a.series_cadence) add('series_cadence', 'Please choose how often they run.');
      break;

    case 'dates':
      if (!a.start_date) add('start_date', 'Start date is required — the day entries open.');
      if (!a.end_date) add('end_date', 'End date is required — the day entries close.');
      if (a.start_date && a.end_date && a.end_date <= a.start_date) {
        add('end_date', 'End date has to be after the start date.');
      }
      if (a.voting_end_date && a.end_date && a.voting_end_date <= a.end_date) {
        add('voting_end_date', 'Voting has to close after the end date.');
      }
      break;

    case 'guest_submit':
      if (!filled(a.contact_name)) add('contact_name', 'Your name is required.');
      if (!looksLikeEmail(a.contact_email)) add('contact_email', 'Please enter a valid email address — we set your account up against it.');
      if (!filled(a.organisation_name || a.org_name)) add('organisation_name', 'Organisation, school or group name is required.');
      break;

    case 'email_verify':
      if (!a.email_verified) add('email_verified', 'Please verify your email to continue.');
      break;

    default:
      break;
  }
  return errors;
}
```

---

## Screen Router — ApplyScreenBody.jsx

**File:** `src/components/host/apply/ApplyScreenBody.jsx`

```jsx
/** Renders the body for one wizard screen key (see src/lib/applyWizardModel.js). */
import QuestionTiles from '@/components/host/QuestionTiles';
import AddonPicker from '@/components/host/AddonPicker';
import OrganisationStep from '@/components/host/apply/OrganisationStep';
import WinnerPolicyStep from '@/components/host/apply/WinnerPolicyStep';
import JudgesStep from '@/components/host/apply/JudgesStep';
import DatesStep from '@/components/host/apply/DatesStep';
import ApplicationFinalStep from '@/components/host/apply/ApplicationFinalStep';
import GuestDetailsStep from '@/components/host/apply/GuestDetailsStep';
import EmailVerifyStep from '@/components/host/apply/EmailVerifyStep';
import PackageStep from '@/components/host/apply/PackageStep';
import { PARTICIPANT_OPTIONS, SCOPE_OPTIONS, SERIES_COUNT_OPTIONS, SERIES_CADENCE_OPTIONS } from '@/components/host/applySteps';

export default function ApplyScreenBody({
  screenKey, answers, set, setScope, defaults, packageOptions, categoryOptions,
  organisation, discoveryBodies, draftId, resolvedAnswers, onSubmitted,
  isAuthenticated, isLoadingAuth, guestCanSubmit, errors = [],
  verifyEmail, onAdvance,
}) {
  switch (screenKey) {
    case 'delivery_level':
      return <PackageStep value={answers.delivery_level} onChange={(v) => set('delivery_level', v)} />;

    case 'host_type':
      return <OrganisationStep organisation={organisation} answers={answers} set={set} errors={errors} isAuthenticated={isAuthenticated} />;

    case 'challenge_kind':
    case 'activity_format':
    case 'audience':
    case 'setting':
    case 'template':
      return discoveryBodies[screenKey] || null;

    case 'category':
      return <QuestionTiles options={categoryOptions} value={answers.category} onChange={(v) => set('category', v)} recommended={defaults.category} />;

    case 'participant_range':
      return <QuestionTiles options={PARTICIPANT_OPTIONS} value={answers.participant_range} onChange={(v) => set('participant_range', v)} recommended={defaults.participant_range} />;

    case 'winner_method':
      return <WinnerPolicyStep accepted={answers.judging_policy_accepted} onAccept={(v) => set('judging_policy_accepted', v)} />;

    case 'judges':
      return <JudgesStep answers={answers} set={set} />;

    case 'program_scope':
      return <QuestionTiles options={SCOPE_OPTIONS} value={answers.program_scope} onChange={setScope} recommended={defaults.program_scope} />;

    case 'series_count':
      return <QuestionTiles options={SERIES_COUNT_OPTIONS} value={answers.series_count} onChange={(v) => set('series_count', v)} />;

    case 'series_cadence':
      return <QuestionTiles options={SERIES_CADENCE_OPTIONS} value={answers.series_cadence} onChange={(v) => set('series_cadence', v)} />;

    case 'dates':
      return <DatesStep answers={answers} set={set} />;

    case 'addons':
      return <AddonPicker value={answers.addons?.length ? answers.addons : defaults.addons} onChange={(v) => set('addons', v)} recommended={defaults.addons} />;

    case 'email_verify':
      return (
        <EmailVerifyStep
          email={verifyEmail}
          verified={!!answers.email_verified && answers.verified_email === verifyEmail}
          onVerified={() => { set('email_verified', true); set('verified_email', verifyEmail); }}
          onAdvance={onAdvance}
        />
      );

    case 'payment':
      return (
        <ApplicationFinalStep
          draftId={draftId}
          answers={resolvedAnswers}
          isAuthenticated
          isLoadingAuth={false}
          onSubmitted={onSubmitted}
        />
      );

    case 'guest_submit':
      return (
        <GuestDetailsStep
          answers={answers}
          set={set}
        />
      );

    default:
      return null;
  }
}
```

---

## Wizard Shell — WizardShell.jsx

**File:** `src/components/host/WizardShell.jsx`

```jsx
/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.2 (guided wizard — full-width question text, one question at a time).
 */
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function WizardShell({
  stepIndex,
  totalSteps,
  question,
  hint,
  children,
  onBack,
  onNext,
  nextDisabled,
  nextLabel = 'Continue',
  submitting = false,
  hideNext = false,
  phaseLabel = 'Step 1: Apply',
  footerNote,
  progress,
  errorPanel,
}) {
  const pct = Math.round(((stepIndex + 1) / totalSteps) * 100);
  return (
    <div className="mx-auto w-full max-w-3xl rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-xl shadow-black/10 sm:p-8">
      <div className="mb-8">
        {progress || (
          <>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {phaseLabel} · question {stepIndex + 1} of {totalSteps}
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full grad-bg transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
      </div>

      <h2 className="font-heading text-2xl font-extrabold sm:text-3xl">{question}</h2>
      {hint && <p className="mt-2 text-sm text-muted-foreground">{hint}</p>}

      {errorPanel && <div className="mt-5">{errorPanel}</div>}

      <div className="mt-6">{children}</div>

      <div className="mt-8 flex items-center justify-between gap-3">
        {onBack ? (
          <Button type="button" variant="outline" onClick={onBack} className="border-border text-foreground hover:bg-muted hover:text-primary">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {footerNote}
          {!hideNext && (
            <Button type="button" onClick={onNext} disabled={nextDisabled || submitting} className="grad-bg border-0">
              {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {nextLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Wizard Progress — WizardProgress.jsx

**File:** `src/components/host/apply/WizardProgress.jsx`

```jsx
/** Seven-segment progress bar — one segment per wizard phase. */
import { PHASES } from '@/lib/applyWizardModel';

export default function WizardProgress({ phase, stepIndex, totalSteps }) {
  const activeIndex = Math.max(0, PHASES.findIndex((p) => p.key === phase));
  const label = PHASES[activeIndex]?.label || '';

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label} · question {stepIndex + 1} of {totalSteps}
      </p>
      <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={PHASES.length} aria-valuenow={activeIndex + 1} aria-label={`Step ${activeIndex + 1} of ${PHASES.length}: ${label}`}>
        {PHASES.map((p, i) => (
          <span
            key={p.key}
            title={p.label}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i <= activeIndex ? 'grad-bg' : 'bg-muted'}`}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## Wizard Error Panel — WizardErrorPanel.jsx

**File:** `src/components/host/apply/WizardErrorPanel.jsx`

```jsx
/** Per-screen validation errors — a red panel that scrolls itself into view. */
import { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

export default function WizardErrorPanel({ errors = [] }) {
  const ref = useRef(null);

  useEffect(() => {
    if (errors.length) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [errors]);

  if (!errors.length) return null;

  return (
    <div ref={ref} role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-destructive">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        {errors.length === 1 ? 'One thing to fix before we continue' : `${errors.length} things to fix before we continue`}
      </p>
      <ul className="mt-2 space-y-1 pl-6 text-sm text-destructive">
        {errors.map((e) => (
          <li key={`${e.field}-${e.message}`} className="list-disc">{e.message}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Category Pick Flow — CategoryPickFlow.jsx

**File:** `src/components/host/apply/CategoryPickFlow.jsx`

```jsx
/**
 * Guided, category-first challenge discovery: category tile → activity format →
 * age group → setting → ranked shortlist. Exposed as wizard steps so the host
 * application keeps its progress bar and Back/Continue chrome.
 */
import { useEffect, useState } from 'react';
import PhotoQuestionTiles from '@/components/host/apply/PhotoQuestionTiles';
import { FORMAT_IMAGES, AGE_IMAGES, SETTING_IMAGES } from '@/components/host/apply/tileImages';
import CategoryTiles from '@/components/host/apply/CategoryTiles';
import TemplateShortlist from '@/components/host/apply/TemplateShortlist';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ChallengeBannerUpload from '@/components/host/apply/ChallengeBannerUpload';
import DescriptionTipsNote from '@/components/host/apply/DescriptionTipsNote';
import EntryTypeMultiSelect from '@/components/challenges/EntryTypeMultiSelect';
import AiDescriptionButton, { DESC_MAX, DESC_MIN_WORDS, DESC_TARGET_WORDS } from '@/components/host/apply/AiDescriptionButton';
import { AGE_OPTIONS, SETTING_OPTIONS, formatsFor } from '@/components/host/apply/discoveryOptions';
import { templateLibrary } from '@/lib/templateLibrary';
import { CATEGORY_OPTIONS } from '@/components/host/applySteps';

function ShortlistStep({ answers, set, setAnswers }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const custom = !!answers.custom_challenge_idea;
  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === answers.category)?.label || '';

  useEffect(() => {
    let alive = true;
    setLoading(true);
    templateLibrary
      .recommend(
        {
          host_type: answers.host_type,
          delivery_level: answers.delivery_level,
          org_kind: answers.org_kind,
          category: answers.category,
          format: answers.discovery_format,
          age_group: answers.discovery_age,
          setting: answers.discovery_setting,
        },
        4
      )
      .then((res) => alive && setTemplates(res.templates || []))
      .catch(() => alive && setError('We could not load our challenge library just now.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers.category, answers.discovery_format, answers.discovery_age, answers.discovery_setting]);

  const choose = (t) =>
    setAnswers((a) => ({
      ...a,
      template_id: t.id,
      template_name: t.template_name,
      custom_challenge_idea: false,
      challenge_title: t.template_name || a.challenge_title,
      challenge_description: t.summary || a.challenge_description,
    }));

  if (custom) {
    const description = answers.challenge_description || '';
    const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-secondary/50 p-5">
        <p className="text-xs text-muted-foreground">
          Happy to build something new for you in {categoryLabel} — custom builds take a little longer to set up, and
          we'll confirm the details with you.
        </p>

        <div>
          <label className="mb-1 block text-sm font-semibold text-[#102A43]" htmlFor="challenge_title">Challenge name</label>
          <Input
            id="challenge_title"
            className="bg-card"
            maxLength={80}
            value={answers.challenge_title || ''}
            onChange={(e) => set('challenge_title', e.target.value)}
            placeholder="e.g. Reimagine Our Packaging"
          />
        </div>

        <ChallengeBannerUpload value={answers.cover_image || ''} onChange={(v) => set('cover_image', v)} />

        <DescriptionTipsNote />

        <div>
          <label className="mb-1 block text-sm font-semibold text-[#102A43]" htmlFor="challenge_description">
            What should people create?
          </label>
          <Textarea
            id="challenge_description"
            rows={4}
            className="bg-card"
            maxLength={DESC_MAX}
            value={description}
            onChange={(e) => set('challenge_description', e.target.value)}
            placeholder="Describe the brief in a few sentences."
          />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>At least {DESC_MIN_WORDS} words — around {DESC_TARGET_WORDS} works best.</span>
            <span>{description.length} / {DESC_MAX} characters · {wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          </div>
          <div className="mt-2">
            <AiDescriptionButton
              title={answers.challenge_title}
              description={description}
              category={answers.category}
              onGenerated={(text) => set('challenge_description', text)}
            />
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold text-[#102A43]">What can people submit?</p>
          <p className="mb-2 text-xs text-muted-foreground">
            Tick every kind of entry you'll accept — participants can then only upload these. Leave all unticked to accept everything.
          </p>
          <EntryTypeMultiSelect
            value={answers.accepted_entry_types || []}
            onChange={(v) => set('accepted_entry_types', v)}
          />
        </div>

        <button
          type="button"
          onClick={() => setAnswers((a) => ({ ...a, custom_challenge_idea: false }))}
          className="text-sm font-semibold text-primary underline"
        >
          Back to our suggestions
        </button>
      </div>
    );
  }

  return (
    <TemplateShortlist
      templates={templates}
      loading={loading}
      error={error}
      selectedId={answers.template_id}
      onSelect={choose}
      onCustom={() =>
        setAnswers((a) => ({ ...a, custom_challenge_idea: true, template_id: '', template_name: '' }))
      }
    />
  );
}

export default function useCategoryPickSteps({ answers, set, setAnswers }) {
  // Changing category invalidates every later answer in this flow.
  const pickCategory = (v) =>
    setAnswers((a) => ({
      ...a,
      category: v,
      discovery_format: '',
      discovery_age: '',
      discovery_setting: '',
      template_id: '',
      template_name: '',
      custom_challenge_idea: false,
    }));

  return [
    {
      question: 'What kind of challenge would you like to run?',
      hint: 'Pick the area that fits best — we\'ll guide you to the right challenge from there.',
      body: <CategoryTiles value={answers.category} onChange={pickCategory} />,
      valid: () => !!answers.category,
    },
    {
      question: 'What kind of activity is this?',
      hint: 'How would you like people to take part?',
      body: (
        <PhotoQuestionTiles
          images={FORMAT_IMAGES}
          options={formatsFor(answers.category)}
          value={answers.discovery_format}
          onChange={(v) => set('discovery_format', v)}
        />
      ),
      valid: () => !!answers.discovery_format,
    },
    {
      question: 'Who is this for?',
      body: (
        <PhotoQuestionTiles
          images={AGE_IMAGES}
          options={AGE_OPTIONS}
          value={answers.discovery_age}
          onChange={(v) => set('discovery_age', v)}
        />
      ),
      valid: () => !!answers.discovery_age,
    },
    {
      question: 'Where will this take place?',
      body: (
        <PhotoQuestionTiles
          images={SETTING_IMAGES}
          options={SETTING_OPTIONS}
          value={answers.discovery_setting}
          onChange={(v) => set('discovery_setting', v)}
        />
      ),
      valid: () => !!answers.discovery_setting,
    },
    {
      question: 'Here are the challenges that fit best',
      hint: 'Pick the one you like — you can still adjust the name and wording later.',
      body: <ShortlistStep answers={answers} set={set} setAnswers={setAnswers} />,
      valid: () =>
        !!answers.template_id ||
        (!!answers.custom_challenge_idea &&
          !!answers.category &&
          answers.challenge_title.trim().length >= 3 &&
          answers.challenge_description.trim().length > 0),
    },
  ];
}
```

---

*End of Part 2. Continue to Part 3 for all step components.*