import { Sparkles } from 'lucide-react';

const VIDEO_URL = 'https://media.base44.com/videos/public/6a683318ec3c2cc96e77b420/64e339d30_Banner_Video.mp4';

/** Hero-side video card — the film plays fully visible, with a caption below. */
export default function HostHeroVideo() {
  return (
    <div className="w-full">
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        <Sparkles className="h-3.5 w-3.5" /> See a challenge in action
      </span>
      <div className="mt-3 overflow-hidden rounded-3xl border border-border bg-black shadow-2xl shadow-black/40">
        <video
          className="aspect-video h-auto w-full object-cover"
          src={VIDEO_URL}
          autoPlay
          loop
          muted
          playsInline
          controls
          preload="metadata"
          aria-label="Creators competing in 53 Challenges — painting, dancing, photography and a trophy celebration"
        />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Real people. Real entries. Real prizes.</span>{' '}
        This is what your challenge looks like once it goes live — creators entering, the community
        voting, judges scoring, and a winner celebrated on your branded page.
      </p>
    </div>
  );
}