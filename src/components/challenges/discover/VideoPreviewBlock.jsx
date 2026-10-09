import { useState } from 'react';
import { Play } from 'lucide-react';
import { workKind } from './EntryWorkMedia';

// Preview for a video entry that has no thumbnail: the first frame of the file
// itself when it is a direct file, or a dark play placeholder when it is an
// embedded player. The embed case matters here — upstream re-hosts uploads on
// Vimeo and hands back a player URL, and a <video> tag cannot play a page, so
// only a real file goes into one. Clicking opens the full viewer either way.
export default function VideoPreviewBlock({ entry, onView }) {
  const { kind, url } = workKind(entry);
  const [failed, setFailed] = useState(false);
  const showVideo = kind === 'video' && !!url && !failed;

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onView?.(); }}
      aria-label={`Watch content: ${entry.title || 'entry'}`}
      className="group relative mt-4 block w-full cursor-pointer overflow-hidden rounded-xl bg-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      {showVideo ? (
        <video
          src={url}
          preload="metadata"
          muted
          playsInline
          onError={() => setFailed(true)}
          className="pointer-events-none h-48 w-full object-cover"
        />
      ) : (
        <div className="h-48 w-full bg-gradient-to-br from-stone-800 via-stone-900 to-black" />
      )}

      <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/40">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-teal-700 shadow-lg transition-transform group-hover:scale-105">
          <Play className="ml-0.5 h-6 w-6" />
        </span>
      </span>

      <span className="absolute bottom-2 left-3 text-xs font-semibold text-white/90 drop-shadow">
        {kind === 'audio' ? 'Tap to listen' : 'Tap to watch'}
      </span>
    </button>
  );
}
