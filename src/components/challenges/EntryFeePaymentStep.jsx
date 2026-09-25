import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2, Lock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

function CheckoutForm({ fee, onPaid }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');

  const handlePay = async (e) => {
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
      setMessage(error.message || 'Payment failed');
      setProcessing(false);
    } else {
      onPaid();
    }
  };

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-3">
        <PaymentElement />
      </div>
      {message && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertTriangle className="w-4 h-4" /> {message}
        </p>
      )}
      <Button type="submit" disabled={!stripe || processing} className="w-full bg-primary text-primary-foreground hover:brightness-110">
        {processing ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
        ) : (
          <>Pay ${fee.toFixed(2)} AUD & Submit</>
        )}
      </Button>
      <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <Lock className="w-3 h-3" /> Secure payment via Stripe
      </p>
    </form>
  );
}

/**
 * Entry-fee payment step. Creates a Stripe PaymentIntent via the `challengeFunds`
 * backend function, collects card details with Stripe Elements, then hands the
 * confirmed payment intent id back to the parent so it can record the entry.
 */
export default function EntryFeePaymentStep({ challengeId, divisionId, email, fee, onPaid }) {
  const [clientSecret, setClientSecret] = useState('');
  const [stripePromise, setStripePromise] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('challengeFunds', {
          action: 'create_intent',
          challenge_id: challengeId,
          division_id: divisionId,
        });
        if (!active) return;
        const data = res.data || {};
        if (data.error) throw new Error(data.error);
        setClientSecret(data.client_secret);
        setPaymentIntentId(data.payment_intent_id || '');
        if (data.publishable_key) setStripePromise(loadStripe(data.publishable_key));
      } catch (e) {
        if (active) setError(e?.message || 'Payment setup unavailable');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [challengeId, divisionId, email, fee]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !stripePromise || !clientSecret) {
    return (
      <div className="px-4 py-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
        <p className="font-semibold text-foreground">Entry-fee payment is being finalised</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Please contact support to complete your entry for this paid challenge.
        </p>
        {error && <p className="mt-2 text-xs text-muted-foreground">{error}</p>}
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm fee={fee} onPaid={() => onPaid(paymentIntentId)} />
    </Elements>
  );
}