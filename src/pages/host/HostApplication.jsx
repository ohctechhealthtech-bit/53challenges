/**
 * /host-apply — one-question-per-screen host application wizard.
 *
 * Screens come from buildScreens() (src/lib/applyWizardModel.js), so the total
 * is always calculated from the answers so far. Validation runs per screen via
 * validateQuestion() and shows a red panel that scrolls into view. Answers
 * autosave to a server-side draft. Signed-in hosts finish on Payment; visitors
 * finish on "Your details", which creates the account and takes payment.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import WizardShell from '@/components/host/WizardShell';
import WizardProgress from '@/components/host/apply/WizardProgress';
import WizardErrorPanel from '@/components/host/apply/WizardErrorPanel';
import ApplyScreenBody from '@/components/host/apply/ApplyScreenBody';
import OnboardingChecklist from '@/components/host/OnboardingChecklist';
import useCategoryPickSteps from '@/components/host/apply/CategoryPickFlow';
import DraftSavedNote from '@/components/host/DraftSavedNote';
import usePackageOptions from '@/components/host/usePackageOptions';
import useApplicationDraft from '@/components/host/apply/useApplicationDraft';
import ApplicationSubmitted from '@/components/host/apply/ApplicationSubmitted';
import useCategoryOptions from '@/components/host/useCategoryOptions';
import useHostOrganisation from '@/components/host/apply/useHostOrganisation';
import { hostPortal } from '@/lib/hostPortalClient';
import { judgesMaster } from '@/lib/judgesMaster';
import { pricingCalculator } from '@/lib/pricingCalculator';
import { quoteToApplyAnswers } from '@/lib/quoteToApplyAnswers';
import {
  buildScreens, validateQuestion, divisionsForAudience, isSeriesScope, usesJudgePanel,
} from '@/lib/applyWizardModel';
import { getWizardDefaults, participantCount, toStructuredAnswers } from '@/lib/hostWizardDefaults';
import { useAuth } from '@/lib/AuthContext';

const PACKAGE_KEYS = ['self_service', 'supported', 'fully_managed'];

const BLANK_ANSWERS = {
  host_type: 'business',
  delivery_level: 'supported',
  challenge_title: '',
  challenge_description: '',
  template_id: '',
  template_name: '',
  custom_challenge_idea: false,
  accepted_entry_types: [],
  discovery_format: '',
  discovery_age: '',
  discovery_setting: '',
  participant_range: '50_250',
  start_date: '',
  end_date: '',
  category: '',
  content_type: '',
  winner_method: 'combination',
  judging_policy_accepted: false,
  org_name: '',
  org_kind: 'business',
  org_contact_email: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  organisation_name: '',
  org_state: '',
  org_abn: '',
  beneficiary_for: '',
  beneficiary_name: '',
  beneficiary_contact_name: '',
  beneficiary_contact_email: '',
  beneficiary_contact_role: '',
  beneficiary_contact_phone: '',
  beneficiary_website: '',
  beneficiary_notes: '',
  divisions: [],
  judge_source: 'platform',
  host_judges: [],
  selected_judge_ids: [],
  host_judge_ids: [],
  program_scope: '',
  series_count: '',
  series_cadence: '',
  addons: [],
  email_verified: false,
  verified_email: '',
};

export default function HostApplication({ embedded = false }) {
  const { isAuthenticated, isLoadingAuth, user } = useAuth();
  const { search } = useLocation();
  const urlParams = new URLSearchParams(search);
  const urlPackage = urlParams.get('package');
  const quoteId = urlParams.get('quote_id') || '';
  const preselected = PACKAGE_KEYS.includes(urlPackage) ? urlPackage : null;
  const packageOptions = usePackageOptions();
  const { options: categoryOptions } = useCategoryOptions();
  const { organisation, reload: reloadOrg } = useHostOrganisation();
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState([]);
  const { answers, setAnswers, draftId, loaded, savedAt } = useApplicationDraft(
    preselected ? { ...BLANK_ANSWERS, delivery_level: preselected } : BLANK_ANSWERS
  );

  useEffect(() => {
    if (!preselected || !loaded) return;
    setAnswers((a) => ({ ...a, delivery_level: preselected }));
  }, [preselected, loaded, setAnswers]);

  // Arriving from the pricing calculator: prefill from the saved quote once.
  useEffect(() => {
    if (!quoteId || !loaded) return;
    pricingCalculator.getSavedQuote(quoteId).then((res) => {
      if (!res?.saved_quote) return;
      setAnswers((a) => (a.saved_quote_id === quoteId ? a : { ...a, ...quoteToApplyAnswers(res.saved_quote) }));
    }).catch(() => {});
  }, [quoteId, loaded, setAnswers]);

  const defaults = useMemo(
    () => getWizardDefaults(answers.host_type, answers.delivery_level, participantCount(answers.participant_range)),
    [answers.host_type, answers.delivery_level, answers.participant_range]
  );

  const set = (k, v) => setAnswers((a) => ({ ...a, [k]: v }));

  // Series follow-ups only apply to ongoing formats — confirm before clearing.
  const setScope = (v) => {
    const clearing = isSeriesScope(answers.program_scope) && !isSeriesScope(v) &&
      (answers.series_count || answers.series_cadence);
    if (clearing && !window.confirm('Switching back to a one-off clears how many challenges you chose and how often they run. Continue?')) return;
    setAnswers((a) => ({
      ...a,
      program_scope: v,
      ...(isSeriesScope(v) ? {} : { series_count: '', series_cadence: '' }),
    }));
  };

  const series = isSeriesScope(answers.program_scope);
  // Age divisions come from the "Who is this for?" answer — never asked twice.
  const divisions = divisionsForAudience(answers.discovery_age);
  const panel = usesJudgePanel(answers.winner_method);
  const needsHostDetails = !organisation && answers.host_type !== 'individual';
  // The email to verify: the signed-in user's account email, or the guest's
  // contact email. Reset the verified flag if the email has changed.
  const verifyEmail = isAuthenticated ? (user?.email || '') : (answers.contact_email || answers.org_contact_email || '').trim().toLowerCase();

  const resolvedAnswers = {
    ...answers,
    divisions: divisions.length ? divisions : defaults.divisions,
    addons: answers.addons.length ? answers.addons : defaults.addons,
    series_count: series ? Number(answers.series_count) || 0 : 0,
    series_cadence: series ? answers.series_cadence : '',
    content_type: answers.content_type || 'admin_managed',
    scale_band: answers.participant_range,
    judge_source: panel ? (answers.judge_source || 'platform') : 'platform',
    host_judges: panel
      ? (answers.host_judges || []).filter((j) => (j.name || '').trim() && (j.email || '').includes('@'))
      : [],
    selected_judge_ids: panel ? (answers.selected_judge_ids || []) : [],
    host_judge_ids: panel ? (answers.host_judges || []).map((j) => j.id).filter(Boolean) : [],
    judge_ids: panel
      ? [...(answers.selected_judge_ids || []), ...(answers.host_judges || []).map((j) => j.id).filter(Boolean)]
      : [],
    org_name: answers.org_name || answers.organisation_name,
    contact_email: answers.contact_email || answers.org_contact_email,
    structured: toStructuredAnswers({
      ...answers,
      divisions: divisions.length ? divisions : defaults.divisions,
    }),
    recommended_snapshot: defaults,
  };

  const discovery = useCategoryPickSteps({ answers, set, setAnswers });
  const discoveryBodies = {
    challenge_kind: discovery[0].body,
    activity_format: discovery[1].body,
    audience: discovery[2].body,
    setting: discovery[3].body,
    template: discovery[4].body,
  };

  const screens = buildScreens(answers, { packagePreselected: !!preselected, isAuthenticated });
  const safeStep = Math.min(step, screens.length - 1);
  const current = screens[safeStep];

  // Errors clear as soon as the host changes an answer on this screen.
  useEffect(() => { setErrors([]); }, [answers, safeStep]);

  // If the email being verified changed, the old verification is stale.
  useEffect(() => {
    if (answers.email_verified && answers.verified_email && answers.verified_email !== verifyEmail) {
      setAnswers((a) => ({ ...a, email_verified: false, verified_email: '' }));
    }
  }, [verifyEmail]);

  // Server-side follow-ups for the screens that create records as they finish.
  const runScreenSideEffects = async (key) => {
    if (key === 'host_type' && !organisation && isAuthenticated) {
      // register_org is a non-essential read-back — the org/workspace is
      // actually created on the main app during submission. If the backend
      // can't resolve identity (e.g. platform session not forwarded),
      // don't block the wizard from advancing.
      try {
        await hostPortal('register_org', {
          name: answers.org_name,
          kind: answers.org_kind,
          contact_email: answers.org_contact_email,
          state: answers.org_state,
          abn: answers.org_abn,
        });
      } catch {
        // Non-essential — the org is created during submission. Don't block Continue.
      }
      await reloadOrg().catch(() => {});
      return;
    }
    if (key === 'judges') {
      const source = answers.judge_source || 'platform';
      // "Use our judges" needs no host-judge save — skip entirely so stale
      // entries from a previous "add my own" selection can't block the step.
      if (source === 'platform') return;
      // Guests can't save judges to the master — they'll be saved after sign-up.
      if (!isAuthenticated) return;
      const rows = answers.host_judges || [];
      const pending = rows.filter((j) => !j.id && (j.name || '').trim() && (j.email || '').includes('@'));
      if (!pending.length) return;
      try {
        const res = await judgesMaster.saveHostJudges(pending);
        const byEmail = {};
        for (const s of res.judges || []) byEmail[(s.email || '').toLowerCase()] = s.id;
        set('host_judges', rows.map((j) => (j.id ? j : { ...j, id: byEmail[(j.email || '').toLowerCase()] || '' })));
      } catch (e) {
        const status = e?.response?.status || e?.status;
        if (status === 401) throw new Error('Your session has expired — please sign in to save your judges.');
        throw e;
      }
    }
  };

  const goNext = async () => {
    const found = validateQuestion(current.key, answers, { needsHostDetails, isAuthenticated });
    if (found.length) { setErrors(found); return; }
    setErrors([]);
    setBusy(true);
    try {
      await runScreenSideEffects(current.key);
      setStep(safeStep + 1);
    } catch (e) {
      setErrors([{ field: '_side_effect', message: e?.message || 'Something went wrong saving this step. Please try again.' }]);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const Wrapper = embedded ? 'div' : 'main';
  const inner = embedded ? '' : 'container-tight';
  const guestCanSubmit = validateQuestion('guest_submit', answers, {}).length === 0;

  return (
    <Wrapper className={embedded ? 'host-light rounded-2xl border border-border p-6 sm:p-8' : 'host-light py-10 sm:py-14'}>
      {submitted ? (
        <div className={`${inner} mx-auto max-w-3xl`}>
          <ApplicationSubmitted title={answers.challenge_title} />
        </div>
      ) : (
        <>
          <div className={`${inner} mb-8 max-w-3xl`}>
            <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">Host a challenge</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Answer a few simple questions and we'll take it from there. Your progress saves automatically.
            </p>
            <div className="mt-6">
              <OnboardingChecklist currentStep={1} />
            </div>
          </div>

          <div className={inner}>
            <WizardShell
              stepIndex={safeStep}
              totalSteps={screens.length}
              question={current.question}
              hint={current.hint}
              onBack={safeStep > 0 ? () => { setErrors([]); setStep(safeStep - 1); } : null}
              onNext={goNext}
              submitting={busy}
              nextLabel={current.nextLabel || 'Continue'}
              hideNext={current.hideNext}
              progress={<WizardProgress phase={current.phase} stepIndex={safeStep} totalSteps={screens.length} />}
              errorPanel={<WizardErrorPanel errors={errors} />}
              footerNote={<DraftSavedNote savedAt={savedAt} />}
            >
              <ApplyScreenBody
                screenKey={current.key}
                answers={answers}
                set={set}
                setScope={setScope}
                defaults={defaults}
                packageOptions={packageOptions}
                categoryOptions={categoryOptions}
                organisation={organisation}
                discoveryBodies={discoveryBodies}
                draftId={draftId}
                resolvedAnswers={resolvedAnswers}
                onSubmitted={() => setSubmitted(true)}
                isAuthenticated={isAuthenticated}
                isLoadingAuth={isLoadingAuth}
                guestCanSubmit={guestCanSubmit}
                errors={errors}
                verifyEmail={verifyEmail}
                onAdvance={goNext}
              />
            </WizardShell>
          </div>
        </>
      )}
    </Wrapper>
  );
}