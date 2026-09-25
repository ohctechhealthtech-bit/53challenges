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