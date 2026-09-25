import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendEmailCode, verifyEmailCode } from '@/lib/emailVerification';

/**
 * Reusable email two-factor step. Sends a 6-digit code to `email` and calls
 * onVerified(token) once it's confirmed. `light` renders on white surfaces.
 */
export default function EmailVerifyGate({ email, purpose, label = 'this request', verified, onVerified, light = false }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // A changed address invalidates any code already confirmed. The parent's
  // token has to be dropped too — it was issued for the previous address, so
  // keeping it left the card showing "Email verified — <new address>" while the
  // server held a token for the old one, and the submission failed with
  // "could not be confirmed" that nothing on screen explained.
  const first = useRef(true);
  useEffect(() => {
    setSent(false); setCode(''); setMsg(''); setError('');
    if (first.current) { first.current = false; return; }
    if (verified) onVerified('');
    // onVerified/verified intentionally omitted: this must fire on an address
    // change only, not whenever the parent re-creates its callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const send = async () => {
    setBusy(true); setError(''); setMsg('');
    const r = await sendEmailCode(email, purpose);
    setBusy(false);
    if (r.error) return setError(r.error);
    setSent(true);
    setMsg('We\u2019ve emailed you a 6-digit code. It expires in 10 minutes.');
  };

  const confirm = async () => {
    setBusy(true); setError(''); setMsg('');
    const r = await verifyEmailCode(email, purpose, code);
    setBusy(false);
    if (r.error) return setError(r.error);
    onVerified(r.verification_token);
  };

  const box = light
    ? 'rounded-2xl border border-stone-200 bg-stone-50 p-5'
    : 'rounded-2xl border border-border bg-white/5 p-5';
  const sub = light ? 'text-stone-600' : 'text-muted-foreground';

  if (verified) {
    return (
      <div className={box}>
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
          <ShieldCheck className="h-4 w-4" /> Email verified — {email}
        </p>
      </div>
    );
  }

  return (
    <div className={box}>
      <p className={`flex items-center gap-2 text-sm font-bold ${light ? 'text-stone-900' : ''}`}>
        <ShieldCheck className="h-4 w-4 text-primary" /> Verify your email
      </p>
      <p className={`mt-1 text-xs ${sub}`}>
        To stop anyone using someone else&rsquo;s address, we email a one-time code before {label} is submitted.
      </p>

      {!sent ? (
        <Button type="button" onClick={send} disabled={busy || !email} className="mt-3 gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {busy ? 'Sending…' : 'Send code'}
        </Button>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="6-digit code"
            className={`w-36 tracking-widest ${light ? 'bg-white text-stone-900' : ''}`}
          />
          <Button type="button" onClick={confirm} disabled={busy || code.length !== 6} className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify
          </Button>
          <button type="button" onClick={send} disabled={busy} className={`text-xs underline ${sub}`}>
            Resend code
          </button>
        </div>
      )}

      {msg && <p className={`mt-2 text-xs ${sub}`}>{msg}</p>}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}