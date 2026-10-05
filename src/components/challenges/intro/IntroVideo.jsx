function embedUrl(url) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  // (?:video/)? — a player page URL reads vimeo.com/video/<id>, not
  // vimeo.com/<id>; without it that form missed and fell to a <video> tag.
  const vim = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vim) return `https://player.vimeo.com/video/${vim[1]}`;
  return null;
}

export default function IntroVideo({ url }) {
  if (!url) return null;
  const embed = embedUrl(url);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-black">
      {embed ? (
        <iframe src={embed} title="Challenge video" className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      ) : (
        <video src={url} controls className="aspect-video w-full" />
      )}
    </div>
  );
}