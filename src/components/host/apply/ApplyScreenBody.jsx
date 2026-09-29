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
      // Told it is authenticated on purpose, though the real flag is in scope.
      // A guest who has passed the email_verify screen before this one is a
      // supported way to pay: hostPortal lists start_application_payment,
      // confirm_payment and submit_application as guest actions and
      // identifies them by that verified email. Passing the real value here
      // would show a sign-in prompt instead of the payment form and end the
      // guest application. The server decides who may pay, as ever.
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