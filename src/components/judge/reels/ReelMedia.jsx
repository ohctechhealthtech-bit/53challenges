// Renders an entry's submitted work: image, video, audio, written text or a link.
import { ExternalLink, FileText } from 'lucide-react';
import PausedPlayVideo from '@/components/media/PausedPlayVideo';

const IMG = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i;
const VID = /\.(mp4|webm|mov|m4v)(\?|$)/i;
const AUD = /\.(mp3|wav|ogg|m4a)(\?|$)/i;

export default function ReelMedia({ entry }) {
  const url = entry.work_url || entry.work_link || entry.media_url || entry.external_link || '';
  const mediaType = (entry.media_type || entry.work_type || '').toLowerCase();
  const type = mediaType === 'text' ? 'text'
    : IMG.test(url) || mediaType === 'image' ? 'image'
    : VID.test(url) || mediaType === 'video' ? 'video'
    : AUD.test(url) || mediaType === 'audio' ? 'audio'
    : url ? 'link' : 'text';

  if (type === 'image') {
    return <img src={url} alt={entry.title} className="h-full w-full object-contain" />;
  }
  if (type === 'video') {
    return <PausedPlayVideo src={url} className="h-full w-full" videoClassName="h-full w-full object-contain" />;
  }
  if (type === 'audio') {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <audio src={url} controls className="w-full max-w-md" />
      </div>
    );
  }
  if (type === 'text') {
    return (
      <div className="h-full w-full overflow-y-auto p-8">
        <FileText className="mb-3 h-6 w-6 text-white/50" />
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">
          {entry.work_text || entry.description || 'No written content provided.'}
        </p>
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-full w-full items-center justify-center gap-2 text-sm font-semibold text-sky-300 hover:underline"
    >
      <ExternalLink className="h-4 w-4" /> Open submission
    </a>
  );
}