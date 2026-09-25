/**
 * Shown after an intake submission — a calm confirmation instead of the
 * internal recommendation screen (which is admin-only now).
 */
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

export default function IntakeConfirmation() {
  return (
    <main className="host-light py-20">
      <div className="container-tight mx-auto max-w-xl text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-[#2E9B66]" aria-hidden="true" />
        <h1 className="mt-6 font-heading text-3xl font-extrabold sm:text-4xl">
          Your proposal has been submitted
        </h1>
        <p className="mt-4 text-muted-foreground">
          Thank you — we've received everything you shared with us. A member of our team will review your
          idea and be in touch within 2 business days. If we need any extra detail, we'll ask then.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center justify-center rounded-xl border border-primary px-5 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}