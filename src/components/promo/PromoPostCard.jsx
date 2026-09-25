import { useState } from 'react';
import { Copy, Check, Trash2, Share2, ExternalLink } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { shareUrlFor, markShared, deletePost, PROMO_PLATFORMS } from '@/lib/participantPromo';

export default function PromoPostCard({ post, onChange }) {
  const [copied, setCopied] = useState(false);
  const fullText = `${post.content}${(post.hashtags || []).length ? `\n\n${post.hashtags.map((h) => `#${h}`).join(' ')}` : ''}`;
  const link = post.entry_id ? `${window.location.origin}/challenges/${post.entry_id}` : window.location.origin;

  const copy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    if (post.status !== 'shared') { await markShared(post.id); onChange?.(); }
  };

  const open = async (platform) => {
    const url = shareUrlFor(platform, fullText, link);
    if (!url) return;
    window.open(url, '_blank', 'noopener');
    if (post.status !== 'shared') { await markShared(post.id); onChange?.(); }
  };

  const shareable = (post.platforms || []).filter((p) => shareUrlFor(p, 'x', 'y'));
  const manual = (post.platforms || []).filter((p) => !shareUrlFor(p, 'x', 'y'));
  const label = (k) => PROMO_PLATFORMS.find((p) => p.k === k)?.l || k;

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{post.challenge_title || 'General post'}</p>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${post.status === 'shared' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-muted text-muted-foreground'}`}>{post.status === 'shared' ? 'Shared' : 'Draft'}</span>
        </div>
        <button onClick={async () => { await deletePost(post.id); onChange?.(); }} className="text-destructive hover:opacity-80" aria-label="Delete post"><Trash2 className="h-4 w-4" /></button>
      </div>
      {post.image_url && <Image src={post.image_url} alt="" className="mt-3 h-44 w-full rounded-xl" />}
      <p className="mt-3 whitespace-pre-wrap text-sm">{post.content}</p>
      {!!(post.hashtags || []).length && <p className="mt-2 text-sm text-primary">{post.hashtags.map((h) => `#${h}`).join(' ')}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary/40">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy post'}
        </button>
        {shareable.map((p) => (
          <button key={p} onClick={() => open(p)} className="inline-flex items-center gap-1.5 rounded-lg grad-bg px-3 py-1.5 text-xs font-bold text-white">
            <Share2 className="h-3.5 w-3.5" /> Share to {label(p)}
          </button>
        ))}
      </div>
      {!!manual.length && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ExternalLink className="h-3.5 w-3.5" /> {manual.map(label).join(', ')}: no direct posting — copy the post and paste it in the app.
        </p>
      )}
    </article>
  );
}