import ChallengeLink from '@/components/challenges/ChallengeLink';
import { Heart, ArrowRight } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { categoryMeta, challengePhase, daysLeft } from '@/lib/challenges-data';

const PHASE_LABEL = {
  upcoming: { text: 'Opens soon', cls: 'bg-blue-500/20 text-blue-300' },
  submit: { text: 'Open for entries', cls: 'bg-emerald-500/20 text-emerald-300' },
  vote: { text: 'Now voting', cls: 'bg-amber-500/20 text-amber-300' },
  closed: { text: 'Closed', cls: 'bg-white/5 text-muted-foreground' },
};

export default function ChallengeCard({ challenge, entryCount = 0 }) {
  const cat = categoryMeta(challenge.category);
  const phase = challengePhase(challenge);
  const phaseMeta = PHASE_LABEL[phase];
  const dLeft = daysLeft(phase === 'submit' ? challenge.submission_ends_at : challenge.voting_ends_at);
  const cover = challenge.cover_image;

  return (
    <ChallengeLink
        challengeId={challenge.id}
        data-challenge-card="1"
        className="card-lift group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card transition-[transform,border-color,box-shadow] duration-280 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="relative h-28 overflow-hidden" style={{ backgroundColor: cat.color }}>
          {cover ? (
            <Image src={cover} alt="" className="absolute inset-0 h-full w-full opacity-80 transition-transform duration-500 group-hover:scale-110" fittingType="fill" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-end pr-5 text-5xl opacity-30 transition-transform duration-500 group-hover:scale-125">
              {cat.icon}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
          <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold" style={{ color: cat.color }}>
            {cat.name}
          </span>
          <span className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-semibold ${phaseMeta.cls}`}>
            {phaseMeta.text}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <h3 className="font-heading text-lg font-bold leading-snug">{challenge.theme}</h3>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{challenge.brief}</p>
          <div className="mt-auto flex items-center gap-3 pt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" aria-hidden="true" /> {challenge.total_votes || 0} votes
            </span>
            {entryCount > 0 && <span>{entryCount} entries</span>}
            {phase !== 'closed' && phase !== 'upcoming' && (
              <span className="font-semibold text-foreground">{dLeft} days left</span>
            )}
            <ArrowRight aria-hidden="true" className="ml-auto h-4 w-4 shrink-0 -translate-x-2 text-primary opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
          </div>
        </div>
      </ChallengeLink>
  );
}