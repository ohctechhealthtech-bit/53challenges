/**
 * Judge details dialog, opened from the judge picker in the host application
 * wizard. Loads the full profile + portfolio from the main site.
 */
import { useEffect, useState } from 'react';
import { MapPin, CalendarDays, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import JudgeAvatar from '@/components/host/apply/JudgeAvatar';
import JudgePortfolioGrid from '@/components/host/apply/JudgePortfolioGrid';
import { hostPortalJudges, prettyWords } from '@/lib/hostPortalJudges';

const Chip = ({ children, tone = 'bg-primary/10 text-primary' }) => (
  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{children}</span>
);

export default function JudgePreviewDialog({ judge, open, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    if (!judge?.id || !open) return undefined;
    let live = true;
    hostPortalJudges.details(judge.id)
      .then((d) => { if (live) setData(d); })
      .catch(() => { if (live) setError("We couldn't load this judge's details right now. Please try again shortly."); });
    return () => { live = false; };
  }, [judge?.id, open]);

  if (!judge) return null;
  const j = data?.judge || judge;
  const location = [j.city, j.state].filter(Boolean).join(', ');
  const since = j.judge_since ? new Date(j.judge_since).getFullYear() : '';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="host-light max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <div className="flex items-start gap-3 text-left">
            <JudgeAvatar judge={j} size="h-14 w-14 text-lg" />
            <div className="min-w-0">
              <DialogTitle className="font-heading text-xl font-extrabold">{j.name || 'Panel judge'}</DialogTitle>
              <DialogDescription className="sr-only">Judge details</DialogDescription>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {j.level && <Chip tone="bg-amber-100 text-amber-800">{prettyWords(j.level)} level</Chip>}
                {(j.disciplines || []).map((d) => <Chip key={d}>{prettyWords(d)}</Chip>)}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{location}</span>}
                {since && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Judging since {since}</span>}
              </div>
              {j.availability?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {j.availability.map((a) => <Chip key={a} tone="bg-secondary text-foreground">{prettyWords(a)}</Chip>)}
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        {error && <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

        {!error && (
          <div className="space-y-4">
            {!data ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Entries scored" value={j.entries_scored} />
                  <Stat label="Challenges judged" value={j.challenges_judged} />
                </div>
                {j.bio && <Section label="About">{j.bio}</Section>}
                {j.experience && <Section label="Experience">{j.experience}</Section>}
                <div className="border-t border-border pt-4">
                  <JudgePortfolioGrid works={data.works || []} loading={false} />
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-2xl font-extrabold">{value ?? 0}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm">{children}</p>
    </div>
  );
}