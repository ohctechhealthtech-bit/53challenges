import { Image } from '@/components/ui/image';
import { Award } from 'lucide-react';
import RevealOnScroll from '@/components/home/RevealOnScroll';

export default function CategoryPrevWinners({ winners = [], accent }) {
  if (!winners.length) return null;
  return (
    <section className="border-t border-border bg-card/30">
      <div className="container-tight py-14">
        <RevealOnScroll className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: accent }}>Inspiration</p>
          <h2 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">Previous winners & finalists</h2>
        </RevealOnScroll>
        <RevealOnScroll stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {winners.slice(0, 8).map((w) => (
            <div key={w.id} className="card-lift overflow-hidden rounded-2xl border border-border bg-card">
              <div className="relative aspect-[4/3]">
                {w.entry_image || w.image_url ? (
                  <Image src={w.entry_image || w.image_url} alt={w.entry_title || w.title || 'Entry'} className="h-full w-full" fittingType="fill" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl opacity-30" style={{ background: `linear-gradient(135deg, ${accent}33, transparent)` }}>🏆</div>
                )}
                {(w.rank === 1 || w.placing === 1 || w.is_winner) && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2.5 py-1 text-xs font-bold text-black">
                    <Award className="h-3 w-3" /> Winner
                  </span>
                )}
              </div>
              <div className="p-4">
                <p className="font-heading text-sm font-bold leading-snug">{w.entry_title || w.title || 'Untitled entry'}</p>
                <p className="mt-1 text-xs text-muted-foreground">by {w.creator_name || w.creator || 'Anonymous'}</p>
                {w.challenge_title && <p className="mt-1 text-xs text-muted-foreground">{w.challenge_title}</p>}
              </div>
            </div>
          ))}
        </RevealOnScroll>
      </div>
    </section>
  );
}