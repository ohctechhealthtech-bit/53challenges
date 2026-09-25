/**
 * In-app payment for the host application: start_application_payment →
 * Stripe Elements → confirm_payment → onPaid(invoiceId).
 */
import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2, Lock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hostPortal } from '@/lib/hostPortalClient';
import { formatAud } from '@/lib/hostDeposit';

function PayForm({ amount, invoiceId, clientSecret, onPaid }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');

  const pay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setMessage('');

    // If an earlier attempt already took the payment (e.g. sending the
    // application failed afterwards), don't charge or confirm again — just
    // finish sending it.
    const existing = await stripe.retrievePaymentIntent(clientSecret);
    const alreadyPaid = existing?.paymentIntent?.status === 'succeeded';

    if (!alreadyPaid) {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });
      if (error && !(error.code === 'payment_intent_unexpected_state' && error.payment_intent?.status === 'succeeded')) {
        setMessage(error.message || 'Payment could not be completed');
        setProcessing(false);
        return;
      }
    }
    try {
      await hostPortal('confirm_payment', { invoice_id: invoiceId });
      await onPaid(invoiceId);
    } catch (err) {
      setMessage(err?.message || 'Payment went through, but we could not send your application.');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={pay} className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <PaymentElement />
      </div>
      {message && (
        <p className="flex items-center gap-1 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {message}
        </p>
      )}
      <Button type="submit" disabled={!stripe || processing} className="w-full grad-bg border-0">
        {processing ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
        ) : (
          <>Pay {formatAud(amount / 100)} &amp; send my application</>
        )}
      </Button>
      <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" /> Secure payment, handled by Stripe
      </p>
    </form>
  );
}

export default function ApplicationPaymentStep({ draftId, answers, onPaid }) {
  const [state, setState] = useState({ loading: true, error: '' });
  const [stripePromise, setStripePromise] = useState(null);
  const [clientSecret, setClientSecret] = useState('');
  const [amount, setAmount] = useState(0);
  const [invoiceId, setInvoiceId] = useState('');

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ loading: true, error: '' });
    hostPortal('start_application_payment', { draft_id: draftId, answers })
      .then((data) => {
        if (!active) return;
        setClientSecret(data.client_secret);
        setAmount(data.amount || 0);
        setInvoiceId(data.invoice_id);
        setStripePromise(loadStripe(data.publishable_key));
        setState({ loading: false, error: '' });
      })
      .catch((e) => { if (active) setState({ loading: false, error: e?.message || 'Payment setup unavailable' }); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (state.error || !stripePromise || !clientSecret) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
        <p className="font-semibold">We couldn't open the payment form just now</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.error || "Please try again in a moment, or contact us and we'll take your payment another way."}
        </p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => setAttempt((a) => a + 1)}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
      <PayForm amount={amount} invoiceId={invoiceId} clientSecret={clientSecret} onPaid={onPaid} />
    </Elements>
  );
}