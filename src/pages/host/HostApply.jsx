/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.1 (plain language), D8.2 (guided wizard, silent mapping layer),
 * D8.3 (progressive disclosure), D8.7 (recommended defaults).
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import WizardShell from '@/components/host/WizardShell';
import QuestionTiles from '@/components/host/QuestionTiles';
import AddonPicker from '@/components/host/AddonPicker';
import OnboardingChecklist from '@/components/host/OnboardingChecklist';
import {
  HOST_TYPE_OPTIONS, CATEGORY_OPTIONS, WINNER_OPTIONS,
  DIVISION_OPTIONS, PARTICIPANT_OPTIONS, SCOPE_OPTIONS,
} from '@/components/host/applySteps';
import usePackageOptions from '@/components/host/usePackageOptions';
import ChallengeBasicsFields from '@/components/host/ChallengeBasicsFields';
import DraftSavedNote from '@/components/host/DraftSavedNote';
import { getWizardDefaults, participantCount, toStructuredAnswers } from '@/lib/hostWizardDefaults';
import DepositSummary from '@/components/host/DepositSummary';
import HostDepositPayment from '@/components/host/HostDepositPayment';
import { requiresDeposit } from '@/lib/hostDeposit';

const PACKAGE_KEYS = ['self_service', 'supported', 'fully_managed'];
const DRAFT_KEY = 'host_apply_draft';

const BLANK_ANSWERS = {
  host_type: 'business',
  delivery_level: 'supported',
  challenge_title: '',
  challenge_description: '',
  participant_range: '50_250',
  category: '',
  winner_method: '',
  divisions: [],
  program_scope: '',
  addons: [],
};

const loadDraft = () => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {};
  } catch {
    return {};
  }
};

export default function HostApply() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const urlPackage = new URLSearchParams(search).get('package');
  const preselected = PACKAGE_KEYS.includes(urlPackage) ? urlPackage : null;
  const packageOptions = usePackageOptions();
  // Arriving from a package card on /host-a-challenge: the package is already
  // chosen, so skip straight to the next question.
  const [step, setStep] = useState(preselected ? 1 : 0);
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [answers, setAnswers] = useState(() => ({
    ...BLANK_ANSWERS,
    ...loadDraft(),
    ...(preselected ? { delivery_level: preselected } : {}),
  }));

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
    setSavedAt(Date.now());
  }, [answers]);

  const defaults = useMemo(
    () => getWizardDefaults(answers.host_type, answers.delivery_level, participantCount(answers.participant_range)),
    [answers.host_type, answers.delivery_level, answers.participant_range]
  );

  useEffect(() => {
    if (!preselected) return;
    setAnswers((a) => ({ ...a, delivery_level: preselected }));
    setStep((s) => (s === 0 ? 1 : s));
  }, [preselected]);

  const set = (k, v) => setAnswers((a) => ({ ...a, [k]: v }));
  const valueOr = (k) => answers[k] || defaults[k];

  const needsDeposit = requiresDeposit(answers.delivery_level);

  const draftPayload = {
    origin: 'host_apply',
    review_status: 'intake_received',
    challenge_title: answers.challenge_title,
    challenge_description: answers.challenge_description,
    host_type: answers.host_type,
    delivery_level: answers.delivery_level,
    participant_range: answers.participant_range,
    category: valueOr('category'),
    winner_method: valueOr('winner_method'),
    divisions: answers.divisions.length ? answers.divisions : defaults.divisions,
    addons: answers.addons.length ? answers.addons : defaults.addons,
    program_scope: valueOr('program_scope'),
    scale_band: answers.participant_range,
    answers: toStructuredAnswers({
      ...answers,
      category: valueOr('category'),
      winner_method: valueOr('winner_method'),
      program_scope: valueOr('program_scope'),
      divisions: answers.divisions.length ? answers.divisions : defaults.divisions,
    }),
    recommended_snapshot: defaults,
  };

  const submitProposal = async () => {
    const res = await base44.functions.invoke('hostPortal', {
      action: 'submit_proposal',
      proposal: draftPayload,
    });
    if (res.data?.error) throw new Error(res.data.error);
    localStorage.removeItem(DRAFT_KEY);
    navigate('/my-challenge-proposals');
  };

  const steps = [
    {
      question: 'How much help would you like from us?',
      hint: 'All packages run on the same platform — the difference is who does the work.',
      body: <QuestionTiles options={packageOptions} value={answers.delivery_level} onChange={(v) => set('delivery_level', v)} />,
    },
    {
      question: 'Who are you running this challenge for?',
      hint: "This helps us tailor everything that follows.",
      body: <QuestionTiles options={HOST_TYPE_OPTIONS} value={answers.host_type} onChange={(v) => set('host_type', v)} />,
    },
    {
      question: "What's your challenge about?",
      hint: 'A working title and a couple of sentences is plenty for now.',
      body: (
        <ChallengeBasicsFields
          title={answers.challenge_title}
          description={answers.challenge_description}
          onTitleChange={(v) => set('challenge_title', v)}
          onDescriptionChange={(v) => set('challenge_description', v)}
        />
      ),
      valid: () => answers.challenge_title.trim().length > 1,
    },
    {
      question: 'What kind of entries are you after?',
      body: <QuestionTiles options={CATEGORY_OPTIONS} value={valueOr('category')} onChange={(v) => set('category', v)} recommended={defaults.category} />,
    },
    {
      question: 'How many people do you expect to take part?',
      hint: 'A rough guess is fine — we can adjust later.',
      body: <QuestionTiles options={PARTICIPANT_OPTIONS} value={answers.participant_range} onChange={(v) => set('participant_range', v)} recommended={defaults.participant_range} />,
    },
    {
      question: 'How should the winner be decided?',
      body: <QuestionTiles options={WINNER_OPTIONS} value={valueOr('winner_method')} onChange={(v) => set('winner_method', v)} recommended={defaults.winner_method} />,
    },
    {
      question: 'Who can enter?',
      hint: 'Pick every age group you want to welcome.',
      body: <QuestionTiles multi options={DIVISION_OPTIONS} value={answers.divisions.length ? answers.divisions : defaults.divisions} onChange={(v) => set('divisions', v)} recommended={defaults.divisions} />,
    },
    {
      question: 'Is this a one-off, or something ongoing?',
      body: <QuestionTiles options={SCOPE_OPTIONS} value={valueOr('program_scope')} onChange={(v) => set('program_scope', v)} recommended={defaults.program_scope} />,
    },
    {
      question: 'Would you like us to take care of anything else?',
      hint: "Add any of these services now, or skip and decide later.",
      body: <AddonPicker value={answers.addons.length ? answers.addons : defaults.addons} onChange={(v) => set('addons', v)} recommended={defaults.addons} />,
      nextLabel: needsDeposit ? 'Continue' : 'Send my proposal',
    },
  ];

  if (needsDeposit) {
    steps.push({
      question: 'Confirm and pay your deposit',
      hint: 'Have a quick look over your answers, then pay your deposit right here.',
      body: (
        <div className="space-y-6">
          <DepositSummary proposal={draftPayload} />
          <HostDepositPayment proposal={draftPayload} onPaid={submitProposal} />
        </div>
      ),
      hideNext: true,
    });
  }

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const submit = async () => {
    setSubmitting(true);
    try {
      await submitProposal();
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => (isLast ? submit() : setStep((s) => s + 1));

  return (
    <main className="container-tight py-10 sm:py-14">
      <div className="mx-auto mb-10 max-w-3xl">
        <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">Host a challenge</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Answer a few simple questions and we'll take it from there. It takes about three minutes.
        </p>
        <div className="mt-6">
          <OnboardingChecklist currentStep={1} />
        </div>
      </div>

      <WizardShell
        stepIndex={step}
        totalSteps={steps.length}
        question={current.question}
        hint={current.hint}
        onBack={step > 0 ? () => setStep((s) => s - 1) : null}
        onNext={next}
        nextDisabled={current.valid ? !current.valid() : false}
        nextLabel={current.nextLabel || 'Continue'}
        hideNext={current.hideNext}
        submitting={submitting}
        phaseLabel="Step 1: Apply"
        footerNote={<DraftSavedNote savedAt={savedAt} />}
      >
        {current.body}
      </WizardShell>
    </main>
  );
}