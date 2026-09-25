import { useRef, useState } from 'react';
import { Play } from 'lucide-react';

export default function PausedPlayVideo({ src, className = '', videoClassName = '' }) {
  const ref = useRef(null);
  const [paused, setPaused] = useState(true);

  const play = () => {
    const el = ref.current;
    if (!el) return;
    el.play().catch(() => { el.muted = true; el.play().catch(() => {}); });
  };

  return (
    <div className={`relative ${className}`}>
      <video
        ref={ref}
        src={src}
        controls
        playsInline
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        className={videoClassName}
      />
      {paused && (
        <button
          type="button"
          onClick={play}
          aria-label="Play video"
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-stone-900 shadow-lg">
            <Play className="ml-1 h-7 w-7" />
          </span>
        </button>
      )}
    </div>
  );
}