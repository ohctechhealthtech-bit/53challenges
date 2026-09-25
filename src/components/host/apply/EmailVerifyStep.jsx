/**
 * Email verification step — sits between the wizard details and the payment
 * screen. Auto-sends a 6-digit code on mount, then shows a "Continue to
 * payment" button once the code is confirmed.
 */
import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendEmailCode, verifyEmailCode } from '@/lib/emailVerification';

const RESEND_SECONDS = 45;

export default function EmailVerifyStep({ email, verified, onVerified, onAdvance }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const didAutoSend = useRef(false);

  // Auto-send the code the first time this screen opens.
  useEffect(() => {
    if (verified || !email || didAutoSend.current) return;
    didAutoSend.current = true;
    send();
  }, [verified, email]);

  // Resend countdown timer.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const send = async () => {
    setBusy(true); setError('');
    const r = await sendEmailCode(email, 'host_application');
    setBusy(false);
    if (r.error) return setError(r.error);
    setResendIn(RESEND_SECONDS);
  };

  const confirm = async () => {
    setBusy(true); setError('');
    const r = await verifyEmailCode(email, 'host_application', code);
    setBusy(false);
    if (r.error) return setError(r.error);
    onVerified(r.verification_token || '');
  };

  if (verified) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-bold text-stone-900">Email verified</p>
            <p className="mt-0.5 text-sm text-stone-600">{email}</p>
          </div>
        </div>
        <Button onClick={onAdvance} className="w-full grad-bg border-0">
          Continue to payment <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
          <ShieldCheck className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <p className="font-bold text-stone-900">Verify it&rsquo;s you</p>
          <p className="mt-0.5 text-sm text-stone-600">
            We sent a 6-digit code to <span className="font-semibold">{email}</span>. Enter it to confirm you own this email.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="otp-code" className="mb-1.5 block text-xs font-medium text-stone-500">
          Enter the 6-digit code
        </label>
        <div className="flex items-center gap-3">
          <Input
            id="otp-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="• • • • • •"
            className="flex-1 tracking-[0.3em] bg-white"
          />
          <Button
            type="button"
            onClick={confirm}
            disabled={busy || code.length !== 6}
            className="gap-2 bg-orange-400 text-white hover:bg-orange-500"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Verify
          </Button>
        </div>
      </div>

      <div className="mt-3">
        {resendIn > 0 ? (
          <p className="text-xs text-stone-400">Resend in {resendIn}s</p>
        ) : (
          <button type="button" onClick={send} disabled={busy} className="text-xs text-stone-500 underline hover:text-stone-700">
            Resend code
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}