/**
 * In-app deposit payment for the host wizard. Uses Stripe Elements so the host
 * never leaves the application (no hosted Checkout redirect).
 */
import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2, Lock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { formatAud } from '@/lib/hostDeposit';

function PayForm({ amount, onPaid }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');

  const pay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setMessage('');
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    if (error) {
      setMessage(error.message || 'Payment could not be completed');
      setProcessing(false);
      return;
    }
    try {
      await onPaid();
    } catch (err) {
      setMessage(err?.message || 'Payment went through, but we could not send your proposal.');
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
          <>Pay {formatAud(amount / 100)} deposit &amp; send my proposal</>
        )}
      </Button>
      <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" /> Secure payment, handled by Stripe
      </p>
    </form>
  );
}

export default function HostDepositPayment({ proposal, onPaid }) {
  const [state, setState] = useState({ loading: true, error: '' });
  const [stripePromise, setStripePromise] = useState(null);
  const [clientSecret, setClientSecret] = useState('');
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('hostDepositCheckout', { proposal_data: proposal });
        const data = res.data || {};
        if (!active) return;
        if (data.error) throw new Error(data.error);
        setClientSecret(data.client_secret);
        setAmount(data.amount || 0);
        setStripePromise(loadStripe(data.publishable_key));
        setState({ loading: false, error: '' });
      } catch (e) {
        if (active) setState({ loading: false, error: e?.message || 'Payment setup unavailable' });
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          Please try again in a moment, or contact us and we'll take your deposit another way.
        </p>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
      <PayForm amount={amount} onPaid={onPaid} />
    </Elements>
  );
}