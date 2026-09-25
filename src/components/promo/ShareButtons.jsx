import { useState } from 'react';
import { Link2, Check, Share2, Facebook, Linkedin } from 'lucide-react';

// Opens a platform share intent in a new window. Nothing is auto-published —
// the user always confirms the post on the platform itself.
const openIntent = (url) => window.open(url, '_blank', 'noopener,noreferrer,width=600,height=640');

export default function ShareButtons({ url, text, className = '' }) {
  const [copied, setCopied] = useState(false);
  if (!url) return null;

  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text || 'Check out my entry and give it a vote!');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: text, text, url });
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const btn = 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-primary hover:text-primary';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs font-semibold text-muted-foreground">Share</span>

      <button type="button" onClick={() => openIntent(`https://twitter.com/intent/tweet?text=${t}&url=${u}`)} className={btn} aria-label="Share on X" title="Share on X">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M18.9 2H22l-7 8 8.2 12h-6.4l-5-7.3L6 22H2.9l7.5-8.6L2.5 2h6.6l4.5 6.6L18.9 2Zm-1.1 18h1.7L7.3 3.8H5.5L17.8 20Z" />
        </svg>
      </button>

      <button type="button" onClick={() => openIntent(`https://www.facebook.com/sharer/sharer.php?u=${u}`)} className={btn} aria-label="Share on Facebook" title="Share on Facebook">
        <Facebook className="h-4 w-4" />
      </button>

      <button type="button" onClick={() => openIntent(`https://www.linkedin.com/sharing/share-offsite/?url=${u}`)} className={btn} aria-label="Share on LinkedIn" title="Share on LinkedIn">
        <Linkedin className="h-4 w-4" />
      </button>

      <button type="button" onClick={() => openIntent(`https://wa.me/?text=${t}%20${u}`)} className={btn} aria-label="Share on WhatsApp" title="Share on WhatsApp">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.8 14.2c-.2.7-1.2 1.3-1.9 1.4-.5.1-1.2.1-3.5-.8-2.9-1.2-4.8-4.2-5-4.4-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.3c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.5c-.1.2-.3.3-.1.6.1.3.6 1.1 1.4 1.8 1 .8 1.7 1.1 2 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.5-.1l1.9.9c.2.1.4.2.4.3.1.2.1.7-.1 1.4Z" />
        </svg>
      </button>

      <button type="button" onClick={copy} className={btn} aria-label={copied ? 'Link copied' : 'Copy link'} title={copied ? 'Link copied' : 'Copy link'}>
        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Link2 className="h-4 w-4" />}
      </button>

      {typeof navigator !== 'undefined' && navigator.share && (
        <button type="button" onClick={nativeShare} className={btn} aria-label="Share via device" title="More sharing options">
          <Share2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}