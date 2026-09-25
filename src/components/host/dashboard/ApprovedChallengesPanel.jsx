/**
 * Pinned at the top of the host dashboard — every approved or live challenge
 * the host owns, with its status, dates, content type and activity so far.
 */
import { Link } from 'react-router-dom';
import { CheckCircle2, Calendar, Users, Heart, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ContentTypeBadge from '@/components/ContentTypeBadge';

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'To be confirmed';

export default function ApprovedChallengesPanel({ challenges = [], onManage }) {
  if (!challenges.length) return null;
  return (
    <section className="mb-8 rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-heading text-xl font-extrabold">
        <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden="true" />
        Your approved challenges
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        These are approved and ready — open one to manage it.
      </p>

      <ul className="mt-5 grid gap-4 md:grid-cols-2">
        {challenges.map((c) => (
          <li key={c.key} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                c.status === 'live' ? 'bg-emerald-500 text-white' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {c.status === 'live' ? 'Live' : 'Approved'}
              </span>
              <ContentTypeBadge value={c.content_type} />
            </div>

            <h3 className="mt-2 font-heading text-base font-bold">{c.title}</h3>

            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {fmt(c.start_date)} — {fmt(c.end_date)}
            </p>

            {(c.entries !== null && c.entries !== undefined) && (
              <p className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" /> {c.entries} entries
                </span>
                <span className="flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5" aria-hidden="true" /> {c.votes} votes
                </span>
              </p>
            )}

            <div className="mt-4">
              {c.proposal_id ? (
                <Button type="button" onClick={() => onManage(c.proposal_id)} className="grad-bg border-0">
                  Manage challenge <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button asChild className="grad-bg border-0">
                  <Link to={`/challenges/${c.challenge_id}`}>
                    Open challenge <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}