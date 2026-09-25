import { Link } from 'react-router-dom';
import { Facebook, Linkedin, Link2, Share2 } from 'lucide-react';

/** How winners are chosen, plus quick share links. */
export default function IntroWinnerAndShare({ challengeId, judgeWeight = null, publicWeight = null, title }) {
  const url = `${window.location.origin}/challenges/${challengeId}`;
  const shareText = `Check out this challenge: ${title}`;

  const links = [
    { label: 'Facebook', icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { label: 'LinkedIn', icon: Linkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { label: 'WhatsApp', icon: Share2, href: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + url)}` },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-heading text-lg font-bold">How winners are chosen</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Top entries are shortlisted by public vote. Finalists are then judged by our expert panel.
        </p>
        {judgeWeight !== null && publicWeight !== null && (
          <p className="mt-1 text-sm text-muted-foreground">
            Final score: <b className="text-foreground">{judgeWeight}% Judges</b> + <b className="text-foreground">{publicWeight}% Public Vote</b>
          </p>
        )}
        <Link to="/competition-rules" className="mt-4 inline-flex rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">
          View judging rules
        </Link>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-heading text-lg font-bold">Share this challenge</h2>
        <p className="mt-2 text-sm text-muted-foreground">Invite your friends and get more amazing entries.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Share on ${l.label}`}
              className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-foreground transition hover:bg-primary hover:text-primary-foreground"
            >
              <l.icon className="h-4 w-4" />
            </a>
          ))}
          <button
            onClick={() => navigator.clipboard?.writeText(url)}
            aria-label="Copy link"
            className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-foreground transition hover:bg-primary hover:text-primary-foreground"
          >
            <Link2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}