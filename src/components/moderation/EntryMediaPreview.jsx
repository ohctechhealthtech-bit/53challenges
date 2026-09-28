import { safeExternalUrl } from '@/lib/safeUrl';
import { ExternalLink, Link as LinkIcon } from 'lucide-react';

/** Turn a shared link into an embeddable player URL where we can. */
function embedUrl(url) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/i);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  const dropbox = url.match(/dropbox\.com\/[^\s]+/i);
  if (dropbox) return url.replace(/[?&]dl=0/, '').concat(url.includes('?') ? '&raw=1' : '?raw=1');
  return '';
}

/**
 * Shows a submission's work as clearly as possible: images full size,
 * videos and audio playing inline, shared video links embedded, and
 * anything else as a prominent open-in-new-tab link.
 */
export default function EntryMediaPreview({ entry, url }) {
  if (!url) return null;
  const isImage = /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(url) || entry?.media_type === 'image';
  const isVideo = !isImage && (entry?.media_type === 'video' || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url));
  const isAudio = !isImage && !isVideo && (entry?.media_type === 'audio' || /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(url));
  const embed = !isImage && !isVideo && !isAudio ? embedUrl(url) : '';

  return (
    <div className="space-y-3">
      {isImage && (
        <div className="flex items-center justify-center rounded-xl border border-border bg-black/40 p-2">
          <img src={url} alt={entry?.title || 'Submission'} className="max-h-[65vh] w-auto max-w-full rounded-lg object-contain" />
        </div>
      )}

      {isVideo && (
        <video src={url} controls autoPlay playsInline className="max-h-[65vh] w-full rounded-xl bg-black" />
      )}

      {isAudio && <audio src={url} controls autoPlay className="w-full" />}

      {embed && (
        <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
          <iframe
            src={embed}
            title={entry?.title || 'Submission preview'}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      )}

      {!isImage && !isVideo && !isAudio && !embed && (
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <p className="flex items-start gap-2 text-sm">
            <LinkIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-all text-muted-foreground">{url}</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            This link can't be shown here — open it in a new tab to check the work.
          </p>
        </div>
      )}

      <a
        href={safeExternalUrl(url)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <ExternalLink className="h-4 w-4" /> Open in a new tab
      </a>
    </div>
  );
}