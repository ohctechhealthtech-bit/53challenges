/**
 * Sign-in gate shown before the host application wizard starts, so every
 * application is tied to an account from the very first question.
 */
import { LogIn, UserPlus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HostSignInGate() {
  const returnTo = encodeURIComponent(window.location.href);

  return (
    <main className="container-tight py-14">
      <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-8 text-center">
        <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-primary" />
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">Sign in to host a challenge</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your application, package and payment are saved to your account, so you can pick up where you
          left off and follow your challenge once it's live.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="grad-bg border-0">
            <a href={`/login?returnTo=${returnTo}`}><LogIn className="mr-2 h-4 w-4" /> Sign in</a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/register?returnTo=${returnTo}`}><UserPlus className="mr-2 h-4 w-4" /> Create an account</a>
          </Button>
        </div>
      </div>
    </main>
  );
}