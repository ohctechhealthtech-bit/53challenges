/**
 * Final wizard step: live price breakdown, then either the in-app payment
 * (paid packages/add-ons) or a direct submit (nothing to pay).
 * Sign-in is required here only — the earlier steps are open to everyone.
 */
import { useState } from 'react';
import { Loader2, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hostPortal } from '@/lib/hostPortalClient';
import PricingSummary from '@/components/host/apply/PricingSummary';
import ApplicationPaymentStep from '@/components/host/apply/ApplicationPaymentStep';

function SignInPrompt() {
  const returnTo = encodeURIComponent(window.location.href);
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center">
      <p className="font-heading text-base font-bold">Sign in to finish your application</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        We save your application, package and payment to your account so you can pick it up any time
        and follow your challenge once it's live.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild className="grad-bg border-0">
          <a href={`/login?returnTo=${returnTo}`}><LogIn className="mr-2 h-4 w-4" /> Sign in</a>
        </Button>
        <Button asChild variant="outline">
          <a href={`/register?returnTo=${returnTo}`}><UserPlus className="mr-2 h-4 w-4" /> Create an account</a>
        </Button>
      </div>
    </div>
  );
}

export default function ApplicationFinalStep({ draftId, answers, onSubmitted, isAuthenticated, isLoadingAuth }) {
  const [pricing, setPricing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (invoiceId) => {
    setSubmitting(true);
    setError('');
    try {
      await hostPortal('submit_application', { draft_id: draftId, answers, invoice_id: invoiceId || undefined });
      onSubmitted();
    } catch (e) {
      setError(e?.message || 'We could not send your application just now');
      setSubmitting(false);
      throw e;
    }
  };

  const needsSignIn = !isLoadingAuth && !isAuthenticated;

  return (
    <div className="space-y-6">
      <PricingSummary answers={answers} onPricing={setPricing} draftId={draftId} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {needsSignIn ? (
        <SignInPrompt />
      ) : (
        pricing && (pricing.payment_required ? (
          <ApplicationPaymentStep draftId={draftId} answers={answers} onPaid={submit} />
        ) : (
          <Button onClick={() => submit(null)} disabled={submitting} className="w-full grad-bg border-0">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send my application
          </Button>
        ))
      )}
    </div>
  );
}