// Renders an entry's work — image or video — for the judging workspace/reel.
const isVideo = (url = '') => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || /video/i.test(url);

export default function EntryMediaView({ entry, className = '', fit = 'contain' }) {
  const fitClass = fit === 'cover' ? 'object-cover' : 'object-contain';
  const media = entry?.media_url || entry?.video_url || entry?.work_url || entry?.work_link || entry?.image_url || entry?.thumbnail || '';
  const type = (entry?.media_type || '').toLowerCase();

  if (!media && entry?.work_text) {
    return (
      <div className={`overflow-y-auto rounded-xl bg-secondary p-5 text-sm leading-relaxed ${className}`}>
        <p className="whitespace-pre-wrap">{entry.work_text}</p>
      </div>
    );
  }
  if (!media) {
    return (
      <div className={`flex items-center justify-center rounded-xl bg-secondary text-sm text-muted-foreground ${className}`}>
        No media attached
      </div>
    );
  }
  // A player page is an iframe, whatever the row calls it. Upstream re-hosts
  // uploads on Vimeo and rewrites work_url to player.vimeo.com/video/… while
  // leaving media_type as "video" — and the regex below would have matched
  // the word "video" in that URL and sent it to a <video> tag, which cannot
  // play a page. workKind checks embed hosts first.
  const embed = workKind(entry);
  if (embed.kind === 'embed') {
    return (
      <iframe
        src={embed.url}
        title={entry?.title || 'Entry video'}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        className={`rounded-xl bg-black ${className}`}
      />
    );
  }
  if (type === 'video' || isVideo(media)) {
    return (
      <video src={media} controls playsInline className={`rounded-xl bg-black ${fitClass} ${className}`}>
        Your browser cannot play this video.
      </video>
    );
  }
  return <img src={media} alt={entry?.title || 'Entry media'} className={`rounded-xl bg-black ${fitClass} ${className}`} />;
}