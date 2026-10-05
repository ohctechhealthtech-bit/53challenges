import { Image } from '@/components/ui/image';
import WrittenEntryCard from './WrittenEntryCard';

/** Turn a shared video link into an embeddable player URL where we can. */
function embedUrl(url) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/i);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  return '';
}

/** What kind of work this entry is: image, video, audio, embed or text. */
export function workKind(entry) {
  const url = entry?.work_url || entry?.work_link || '';
  if (!url) return { kind: 'text', url: '' };
  // An embed host wins over media_type, and is checked first. Upstream
  // re-hosts uploaded videos on Vimeo and rewrites work_url to the player
  // page while leaving media_type as "video" — so this used to hand
  // https://player.vimeo.com/video/… to a bare <video> tag, which answers
  // MEDIA_ERR_SRC_NOT_SUPPORTED and sits at 0:00 forever. A player page is
  // an iframe, whatever the row says it is.
  const embed = embedUrl(url);
  if (embed) return { kind: 'embed', url: embed };
  if (/\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(url) || entry?.media_type === 'image') return { kind: 'image', url };
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || entry?.media_type === 'video') return { kind: 'video', url };
  if (/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(url) || entry?.media_type === 'audio') return { kind: 'audio', url };
  return { kind: 'text', url };
}

/**
 * Shows an entry's actual work inside a card frame: photos, videos playing
 * inline, shared video links embedded — and only written text when the entry
 * really is a written one.
 */
export default function EntryWorkMedia({ entry, className = '' }) {
  const { kind, url } = workKind(entry);

  if (kind === 'image') {
    return (
      <Image
        src={url}
        alt={entry.title}
        className={`h-full w-full transition-transform duration-500 group-hover/img:scale-110 ${className}`}
        fittingType="fill"
      />
    );
  }

  if (kind === 'video') {
    return <video src={url} controls playsInline className="absolute inset-0 h-full w-full bg-black" />;
  }

  if (kind === 'embed') {
    return (
      <iframe
        src={url}
        title={entry.title || 'Entry video'}
        className="absolute inset-0 h-full w-full bg-black"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  }

  if (kind === 'audio') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1A] px-6">
        <audio src={url} controls className="w-full" />
      </div>
    );
  }

  return <WrittenEntryCard entry={entry} className="absolute inset-0" />;
}