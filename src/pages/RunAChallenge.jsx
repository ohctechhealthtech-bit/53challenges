import { useState } from 'react';
import { Check, Rocket } from 'lucide-react';
import RunAChallengeForm from '@/components/runachallenge/RunAChallengeForm';

export default function RunAChallenge() {
  const [done, setDone] = useState(false);

  if (done) return (
    <div className="container-tight py-24 text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 text-emerald-400"><Check className="h-10 w-10" /></div>
      <h1 className="mt-6 font-heading text-3xl font-extrabold">Inquiry received!</h1>
      <p className="mx-auto mt-3 max-w-md text-muted-foreground">Thanks for reaching out. Our team will be in touch to plan your challenge. You can track progress in the marketing pipeline.</p>
    </div>
  );

  return (
    <div className="container-tight py-14">
      <div className="mx-auto max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary"><Rocket className="h-3.5 w-3.5" /> Run a Challenge</div>
        <h1 className="mt-4 font-heading text-4xl font-extrabold">Bring a creative challenge to your community</h1>
        <p className="mt-3 text-muted-foreground">Sponsors, councils, schools and workplaces — run a branded creative challenge on 53 Challenges and reach creators across Australia. Submit the form below and we'll be in touch.</p>
        <div className="mt-8">
          <RunAChallengeForm onSuccess={() => setDone(true)} />
        </div>
      </div>
    </div>
  );
}