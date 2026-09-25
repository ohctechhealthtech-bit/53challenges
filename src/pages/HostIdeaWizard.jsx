/**
 * /host-idea — a friendly, guided 3-step way for anyone (no login needed) to
 * share a challenge idea with the 53 Challenges team.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import IdeaContactStep from '@/components/host/idea/IdeaContactStep';
import IdeaPhotoPicker from '@/components/host/idea/IdeaPhotoPicker';
import IdeaBeneficiaryFields from '@/components/host/idea/IdeaBeneficiaryFields';
import { ORG_TYPE_IMAGES } from '@/components/host/idea/ideaTileImages';
import IdeaDetailsStep from '@/components/host/idea/IdeaDetailsStep';
import IdeaPurposeStep from '@/components/host/idea/IdeaPurposeStep';
import IdeaRulesStep from '@/components/host/idea/IdeaRulesStep';
import IdeaFormatStep from '@/components/host/idea/IdeaFormatStep';
import IdeaPracticalStep from '@/components/host/idea/IdeaPracticalStep';
import IdeaConfirmation from '@/components/host/idea/IdeaConfirmation';
import MyIdeasPanel from '@/components/host/idea/MyIdeasPanel';
import useMyIdeas from '@/components/host/idea/useMyIdeas';
import { ORG_TYPE_OPTIONS } from '@/components/host/idea/ideaOptions';

const BLANK = {
  name: '',
  email: '',
  phone: '',
  organisation_name: '',
  org_kind: 'business',
  org_state: '',
  org_abn: '',
  org_type: '',
  org_types: [],
  for_own_organisation: true,
  beneficiary_name: '',
  beneficiary_notes: '',
  template_id: '',
  template_name: '',
  primary_objective: '',
  secondary_objectives: [],
  participant_next_action: '',
  rules_expectations: [],
  rules_notes: '',
  challenge_title: '',
  challenge_description: '',
  activity_type: '',
  age_groups: [],
  participants: '',
  reach: '',
  winner_method: 'combination',
  judging_source: '',
  invited_judges: [],
  platform_judges_notes: '',
  scope: '',
  timing: '',
  prize_pool: '',
  budget: '',
  extra_notes: '',
};

export default function HostIdeaWizard() {
  const [data, setData] = useState(BLANK);
  const [step, setStep] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  // What's still missing on the current step — shown only after they try to move on.
  const [issues, setIssues] = useState([]);
  const [done, setDone] = useState(false);
  // Proof the contact address was confirmed with an emailed code.
  const [emailToken, setEmailToken] = useState('');
  const { ideas: myIdeas } = useMyIdeas();

  useEffect(() => {
    document.title = 'Tell us your idea — 53 Challenges';
  }, []);

  // Signed-in hosts don't retype their details — carry them over from their
  // most recent idea (only into fields they haven't touched yet).
  useEffect(() => {
    const prev = myIdeas[0];
    if (!prev) return;
    const a = prev.answers || {};
    setData((d) => ({
      ...d,
      name: d.name || a.name || '',
      email: d.email || a.email || '',
      phone: d.phone || a.phone || '',
      organisation_name: d.organisation_name || a.organisation_name || '',
      org_kind: a.org_kind || d.org_kind,
      org_state: d.org_state || a.org_state || '',
      org_abn: d.org_abn || a.org_abn || '',
    }));
  }, [myIdeas]);

  // Each new step starts at the top of the page, not wherever the button was.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // If something's missing, bring the explanation into view.
  useEffect(() => {
    if (issues.length || error) {
      document.getElementById('idea-wizard-alert')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [issues, error]);

  const set = (k, v) => {
    setIssues([]);
    if (k === 'email') setEmailToken('');
    setData((d) => ({ ...d, [k]: v }));
  };

  // Hosts can be hosting for more than one kind of group — keep the list,
  // and mirror it into org_type (joined) for the backend/email.
  const setOrgTypes = (list) => {
    setIssues([]);
    const forOthers = list.some((t) => t === 'business' || t === 'school');
    setData((d) => ({
      ...d,
      org_types: list,
      org_type: list.join(', '),
      for_own_organisation: !forOthers,
      beneficiary_name: forOthers ? d.beneficiary_name : '',
      beneficiary_notes: forOthers ? d.beneficiary_notes : '',
    }));
  };

  const needsBeneficiary = (data.org_types || []).some((t) => t === 'business' || t === 'school');

  const steps = [
    {
      title: 'First, how do we reach you?',
      hint: 'So we can get back to you about your idea.',
      body: (
        <>
          <MyIdeasPanel ideas={myIdeas} />
          <IdeaContactStep
            data={data}
            set={set}
            emailVerified={!!emailToken}
            onEmailVerified={setEmailToken}
          />
        </>
      ),
      issues: [
        data.name.trim().length > 1 ? null : 'Your name — please enter your full name.',
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())
          ? null
          : 'Email address — please enter a real address like you@example.com.',
        data.phone.trim().length >= 6 ? null : 'Phone number — please enter a contact number we can call.',
        data.organisation_name.trim().length > 1
          ? null
          : 'Organisation name — tell us the school, business or group you\u2019re with.',
        data.org_kind ? null : 'What kind of organisation you are.',
        emailToken ? null : 'Email verification — send yourself the code and enter it to confirm your address.',
      ].filter(Boolean),
    },
    {
      title: 'Who are you hosting for?',
      hint: 'Pick the one that fits best.',
      body: (
        <>
          <IdeaPhotoPicker
            options={ORG_TYPE_OPTIONS}
            images={ORG_TYPE_IMAGES}
            value={data.org_types[0] || ''}
            onChange={(v) => setOrgTypes(v ? [v] : [])}
          />
          {needsBeneficiary ? <IdeaBeneficiaryFields data={data} set={set} /> : null}
        </>
      ),
      issues: [
        data.org_types.length ? null : 'Please choose who you\u2019re hosting for.',
        !needsBeneficiary || data.beneficiary_name.trim().length > 1
          ? null
          : 'Which organisation or group this challenge is for.',
      ].filter(Boolean),
    },
    {
      title: 'What are you trying to achieve?',
      hint: 'This helps us design a challenge that actually works for your goals.',
      body: <IdeaPurposeStep data={data} set={set} />,
      issues:
        ['business', 'workplace', 'council'].some((t) => data.org_types.includes(t)) && !data.primary_objective
          ? ['Your main goal — pick the one that matters most.']
          : [],
    },
    {
      title: 'Now — your challenge idea',
      hint: "Don't worry about getting it perfect. We'll shape the details together.",
      body: <IdeaDetailsStep data={data} set={set} />,
      issues: [
        data.challenge_title.trim().length >= 3
          ? null
          : 'Challenge title — give it a short working name (at least 3 characters).',
        data.challenge_description.trim().length >= 20
          ? null
          : `Your idea — tell us a bit more about it (${data.challenge_description.trim().length} of at least 20 characters so far).`,
      ].filter(Boolean),
    },
    {
      title: 'Basic Rules & Expectations',
      hint: 'Select what fits your challenge, then describe anything specific below. We will use this to shape the participation flow and moderation settings.',
      body: <IdeaRulesStep data={data} set={set} />,
      issues: [],
    },
    {
      title: 'How would you like it to run?',
      hint: "Rough answers are fine — pick 'not sure' and we'll suggest what works.",
      body: <IdeaFormatStep data={data} set={set} />,
      issues: [
        data.age_groups.length ? null : 'Who can enter — pick at least one age group.',
        data.participants ? null : 'How many people you expect.',
        data.reach ? null : 'How far you want it to reach.',
      ].filter(Boolean),
    },
    {
      title: 'Timing, prizes and budget',
      hint: 'This helps us come to our first conversation with real options for you.',
      body: <IdeaPracticalStep data={data} set={set} />,
      issues: [
        data.scope ? null : 'Whether it\u2019s a one-off or ongoing.',
        data.timing ? null : 'When you\u2019d like it to run.',
        data.prize_pool ? null : 'What prizes you have in mind.',
        data.budget ? null : 'Roughly what budget you have in mind.',
      ].filter(Boolean),
    },
  ];

  const current = steps[step];
  const last = step === steps.length - 1;

  // Continue / Submit always works — if something's missing we say exactly what.
  const advance = () => {
    if (current.issues.length) {
      setIssues(current.issues);
      return;
    }
    setIssues([]);
    if (last) submit();
    else setStep(step + 1);
  };

  const goBack = () => {
    setIssues([]);
    setError('');
    setStep(step - 1);
  };

  const submit = async () => {
    setSending(true);
    setError('');
    try {
      const res = await base44.functions.invoke('hostChallengeRequest', {
        action: 'submit_idea',
        ...data,
        verification_token: emailToken,
      });
      // The server tells us exactly what's wrong (e.g. a missing title) —
      // show that reason so it can be fixed, not a generic failure.
      if (res.data?.error) {
        setError(res.data.error);
        return;
      }
      setDone(true);
    } catch (e) {
      setError('Something went wrong on our end — please try again in a moment.');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="host-light py-14 sm:py-20">
      <div className="container-tight">
        <div className="mx-auto max-w-3xl">
          {done ? (
            <IdeaConfirmation email={data.email} />
          ) : (
            <>
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Tell us your idea</p>
                <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {current.title}
                </h1>
                <p className="mt-3 text-muted-foreground">{current.hint}</p>
              </div>

              <div className="mt-8 flex items-center gap-2" aria-hidden="true">
                {steps.map((s, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-border'}`}
                  />
                ))}
              </div>
              <p className="mt-2 text-center text-xs font-semibold text-muted-foreground">
                Step {step + 1} of {steps.length}
              </p>

              <div className="mt-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
                {current.body}

                {issues.length ? (
                  <div
                    id="idea-wizard-alert"
                    role="alert"
                    className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-4"
                  >
                    <p className="text-sm font-bold text-destructive">
                      {issues.length === 1
                        ? 'We still need one thing before we can continue:'
                        : `We still need ${issues.length} things before we can continue:`}
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm text-destructive">
                      {issues.map((msg) => (
                        <li key={msg} className="flex gap-2">
                          <span aria-hidden="true">•</span>
                          <span>{msg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {error ? (
                  <p id={issues.length ? undefined : 'idea-wizard-alert'} role="alert" className="mt-5 text-sm font-semibold text-destructive">
                    {error}
                  </p>
                ) : null}

                <div className="mt-8 flex items-center justify-between gap-3">
                  {step > 0 ? (
                    <button
                      type="button"
                      onClick={goBack}
                      className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold transition-colors hover:border-primary hover:text-primary"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back
                    </button>
                  ) : (
                    <span />
                  )}

                  <button
                    type="button"
                    disabled={sending}
                    onClick={advance}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                      </>
                    ) : last ? (
                      <>
                        Submit my idea <Send className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Continue <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}