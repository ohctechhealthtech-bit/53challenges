import { Users, Heart, FileText } from 'lucide-react';
import RevealOnScroll from '@/components/home/RevealOnScroll';

// Aggregated participant standings — real entries and votes per creator.
export default function TopParticipants({ participants = [] }) {
  if (!participants.length) return null;

  return (
    <section className="mt-14">
      <h2 className="flex items-center gap-2 font-heading text-2xl font-bold">
        <Users className="h-6 w-6 text-primary" /> Our participants
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">The creators driving this season — ranked by community votes.</p>

      <RevealOnScroll stagger className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {participants.map((p, i) => (
          <div key={p.name + i} className="card-lift rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-heading text-sm font-extrabold ${i < 3 ? 'grad-bg text-white' : 'bg-muted text-muted-foreground'}`}>
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{p.name}</p>
                {p.state && <p className="text-xs text-muted-foreground">{p.state}</p>}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" /> {p.entries} {p.entries === 1 ? 'entry' : 'entries'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-pink-400" /> {p.votes.toLocaleString()} votes
              </span>
            </div>
          </div>
        ))}
      </RevealOnScroll>
    </section>
  );
}