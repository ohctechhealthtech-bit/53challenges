import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Image } from '@/components/ui/image';

// Hero video that stays light on first paint:
// - poster image shows immediately (no bytes of video downloaded until in view)
// - preload="metadata" + the <source> is only attached once the hero scrolls in
// - muted autoplay loop plays once active; falls back to image on error
export default function HeroVideo({ src, poster, alt = '' }) {
  const videoRef = useRef(null);
  const wrapRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [active, setActive] = useState(false);   // src attached + attempting play
  const [inView, setInView] = useState(false);
  const [fallback, setFallback] = useState(false);

  // Wait until the hero is near the viewport before attaching the video source.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) { setInView(true); io.disconnect(); }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || active || fallback) return;
    const v = videoRef.current;
    if (!v) return;
    setActive(true);
    // If the video can't become ready quickly, keep the poster image instead.
    const timer = setTimeout(() => { if (v.readyState < 2) setFallback(true); }, 6000);
    const onErr = () => setFallback(true);
    v.addEventListener('error', onErr);
    return () => { clearTimeout(timer); v.removeEventListener('error', onErr); };
  }, [inView, active, fallback]);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  if (fallback) {
    return (
      <div ref={wrapRef} className="overflow-hidden rounded-[20px] border border-white/10 shadow-2xl shadow-black/60">
        <Image src={poster} alt={alt} className="aspect-[4/3] w-full object-cover" fittingType="fill" />
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="group relative overflow-hidden rounded-[20px] border border-white/10 shadow-2xl shadow-black/60 transition-shadow duration-500 hover:shadow-[0_0_40px_rgba(109,74,255,0.3)]">
      <video
        ref={videoRef}
        poster={poster}
        autoPlay={inView}
        muted
        loop
        playsInline
        preload="metadata"
        className="aspect-[4/3] w-full object-cover"
        aria-label={alt}
      >
        {inView && <source src={src} type="video/mp4" />}
      </video>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/45 via-black/10 to-transparent" />
      {!active && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Image src={poster} alt={alt} className="absolute inset-0 h-full w-full object-cover opacity-0" fittingType="fill" aria-hidden />
        </div>
      )}
      <button
        type="button"
        onClick={toggleMute}
        className="absolute bottom-3 right-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
        aria-label={muted ? 'Unmute video' : 'Mute video'}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>
    </div>
  );
}