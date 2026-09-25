import { Trophy, ShieldCheck, Sparkles } from 'lucide-react';

// Ceremonial header for the Hall of Fame — gold light, engraved type.
export default function HallOfFameHero({ count = 0 }) {
  return (
    <section className="relative overflow-hidden border-b border-amber-500/20">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(70% 90% at 50% 0%, rgba(244,183,64,0.20), transparent 65%), radial-gradient(50% 60% at 80% 20%, rgba(244,183,64,0.08), transparent 70%)',
        }}
      />
      <div className="container-tight py-20 text-center">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-300 shadow-[0_0_60px_-10px_rgba(244,183,64,0.6)]">
          <Trophy className="h-9 w-9" />
        </span>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.35em] text-amber-300/90">
          The Hall of Fame
        </p>
        <h1 className="mt-4 font-heading text-5xl font-extrabold tracking-tight text-balance sm:text-6xl">
          <span className="bg-gradient-to-b from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-transparent">
            Where legends are made
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
          A permanent record of every champion crowned on 53 Challenges. Earned through
          blind judging, verified by independent audit.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-amber-200">
            <Sparkles className="h-3.5 w-3.5" /> {count} {count === 1 ? 'champion' : 'champions'} inducted
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" /> Independently audited
          </span>
        </div>
      </div>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
    </section>
  );
}