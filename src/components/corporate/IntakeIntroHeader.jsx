import { Clock, MessageSquare } from 'lucide-react';

/** Framing header shown above the corporate intake wizard. */
export default function IntakeIntroHeader() {
  return (
    <section className="border-b border-border gradient-hero">
      <div className="container-tight py-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5 text-accent" /> Custom &amp; corporate challenges
        </div>
        <h1 className="mt-4 max-w-3xl font-heading text-3xl font-extrabold text-balance sm:text-4xl">
          Let's discuss your <span className="grad-text">proposal.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          We'll ask a few questions about your concept — nothing technical, just what you have in
          mind. Our team reviews your answers and comes back with a recommended format, judging
          model, scope and pricing. Nothing is locked in until you're happy with it.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          <Clock className="h-3.5 w-3.5" /> Takes about 5 minutes
        </p>
      </div>
    </section>
  );
}