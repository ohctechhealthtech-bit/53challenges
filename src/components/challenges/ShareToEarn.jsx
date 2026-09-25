import { useState } from 'react';
import { Share2, Link2, Check, Gift } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

// Share a challenge to social media and invite friends.
// Each share opens the platform's own share dialog in a new window.
const NETWORKS = [
  { key: 'x', label: 'X', url: (u, t) => `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
  { key: 'facebook', label: 'Facebook', url: (u) => `https://www.facebook.com/sharer/sharer.php?u=${u}` },
  { key: 'whatsapp', label: 'WhatsApp', url: (u, t) => `https://wa.me/?text=${t}%20${u}` },
  { key: 'linkedin', label: 'LinkedIn', url: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
];

export default function ShareToEarn({ challengeId, title }) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const ref = user?.email ? `?ref=${encodeURIComponent(user.email)}` : '';
  const shareUrl = `${window.location.origin}/challenges/${challengeId}${ref}`;
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(`Vote in "${title}" on 53 Challenges`);

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container-tight pt-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 font-heading text-sm font-bold">
              <Gift className="h-4 w-4 text-primary" /> Share &amp; earn extra votes
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Invite friends to this challenge and build up your vote bank to back more entries.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {NETWORKS.map((n) => (
              <a
                key={n.key}
                href={n.url(encodedUrl, encodedText)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold transition hover:border-primary hover:text-primary"
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" /> {n.label}
              </a>
            ))}
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-3 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
              {copied ? 'Link copied' : 'Copy invite link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}