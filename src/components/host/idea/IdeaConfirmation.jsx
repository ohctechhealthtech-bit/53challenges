/** Warm thank-you screen after an idea is submitted. */
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowLeft } from 'lucide-react';

export default function IdeaConfirmation({ email }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-10 text-center">
      <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
        <CheckCircle2 className="h-9 w-9 text-success" aria-hidden="true" />
      </span>
      <h1 className="mt-6 font-heading text-3xl font-extrabold">We've got your idea!</h1>
      <p className="mx-auto mt-4 max-w-md text-muted-foreground">
        Thanks for sharing it with us. We've sent a confirmation to{' '}
        <span className="font-semibold text-foreground">{email}</span>. Our team will read through your
        idea and be in touch within 2 business days to set up a chat about how we can help bring it to life.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-bold transition-colors hover:border-primary hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Link>
    </div>
  );
}