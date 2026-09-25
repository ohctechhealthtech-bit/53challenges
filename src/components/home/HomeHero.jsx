import React, { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Play, ChevronRight, Heart, Loader2, Clock } from "lucide-react";
import { challengeApi } from "@/lib/challengeApi";
import HeroCountdown from "@/components/home/HeroCountdown";
import {
  isPublicChallenge,
  challengePhase,
  isOpenForEntries,
  challengeStatus,
  challengeTitle,
  challengeDescription,
  categoryMeta,
  daysLeft,
} from "@/lib/challenges-data";

// Brand colours (kept in sync with Home.jsx)
const RED = "#F04E37";
const TEAL = "#1BA39C";
const GOLD = "#E8A73B";
const NAVY = "#0B1B3F";

const FALLBACK_HERO =
  "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1400&q=80";

const AUTO_ADVANCE_MS = 6000;

function isImageUrl(url) {
  return /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url || "");
}
function isVideoUrl(url) {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url || "");
}

// Resolve the display thumbnail for an entry (image or video poster).
function entryThumb(e) {
  if (!e) return "";
  if (e.media_type === "image") return e.thumbnail_url || e.work_url || "";
  if (e.media_type === "video") return e.thumbnail_url || "";
  if (e.thumbnail_url) return e.thumbnail_url;
  if (isImageUrl(e.work_url)) return e.work_url;
  return "";
}

/**
 * Dynamic hero carousel. Pulls every currently-running challenge from the API
 * (submission or voting phase) and auto-rotates through them. Each slide uses
 * the challenge's saved cover_image as its backdrop, layered with a collage of
 * the top 3 most-voted entries (image or video thumbnails) for that challenge.
 */
export default function HomeHero() {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);

  // ── Fetch running + recently-active challenges with top entries ────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await challengeApi.listChallenges();
        if (!mounted) return;
        const all = (res.challenges || []).filter(isPublicChallenge);

        // Running challenges first, then recently-closed (still have
        // entries / votes worth showcasing). Sorted most-recent first.
        const ranked = all
          .map((c) => {
            const p = challengePhase(c);
            const score = p === "submit" ? 3 : p === "vote" ? 2 : p === "upcoming" ? 1 : 0;
            return { c, score };
          })
          .sort((a, b) => b.score - a.score || new Date(b.c.start_date || 0) - new Date(a.c.start_date || 0))
          .slice(0, 6)
          .map((x) => x.c);

        // Fetch top entries for each challenge in parallel.
        const built = await Promise.all(
          ranked.map(async (ch) => {
            let topEntries = [];
            try {
              const entries = await challengeApi.listEntries(ch.id);
              topEntries = (entries || [])
                .filter((e) => entryThumb(e) || isVideoUrl(e.work_url) || e.title || e.description)
                .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
                .slice(0, 6);
            } catch {
              /* entries unavailable — still show the challenge */
            }
            return { challenge: ch, topEntries };
          })
        );
        if (mounted) {
          // Keep running challenges (even with 0 entries) + any with entries.
          setSlides(
            built.filter((s) => {
              const p = challengePhase(s.challenge);
              return p === "submit" || p === "vote" || p === "upcoming";
            }).slice(0, 5)
          );
        }
      } catch {
        /* network error — leave empty */
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ── Auto-advance carousel ───────────────────────────────────────────
  const goNext = useCallback(() => {
    setCurrent((c) => (slides.length > 1 ? (c + 1) % slides.length : 0));
  }, [slides.length]);

  const goTo = useCallback(
    (i) => {
      setCurrent(i);
      // restart the timer so manual navigation doesn't get cut short
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(goNext, AUTO_ADVANCE_MS);
    },
    [goNext]
  );

  useEffect(() => {
    if (slides.length <= 1) return;
    timerRef.current = setInterval(goNext, AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [goNext, slides.length]);

  // ── Loading state ───────────────────────────────────────────────────
  if (loading) {
    return (
      <section style={{ backgroundColor: NAVY }} className="relative flex h-[460px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-white/60" />
      </section>
    );
  }

  // ── Empty fallback (no running challenges) ──────────────────────────
  if (slides.length === 0) {
    return (
      <section style={{ backgroundColor: NAVY }} className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={FALLBACK_HERO} alt="" className="h-full w-full object-cover opacity-50" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(11,27,63,0.98) 0%, rgba(11,27,63,0.7) 100%)" }} />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-12">
          <h1 className="c53-hero-in text-5xl font-extrabold leading-tight text-white sm:text-6xl">53 Challenges</h1>
          <p className="c53-hero-in mt-3 max-w-xl text-base text-white/80" style={{ animationDelay: "200ms" }}>
            Australia's home of creative challenges. Compete, vote and get discovered.
          </p>
          <Link to="/challenges" className="c53-hero-in mt-6 inline-block rounded-md px-6 py-3 text-sm font-semibold text-white" style={{ backgroundColor: RED, animationDelay: "400ms" }}>
            Explore Challenges
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section style={{ backgroundColor: NAVY }} className="relative h-[100vh] min-h-[600px] overflow-hidden">
      <style>{`
        @keyframes c53HeroSlideIn { from { opacity: 0; } to { opacity: 1; } }
        .hero-slide { animation: c53HeroSlideIn 0.8s ease forwards; }
      `}</style>

      {/* ── Slides ──────────────────────────────────────────────────── */}
      {slides.map((slide, idx) => {
        const ch = slide.challenge;
        const phase = challengePhase(ch);
        const status = challengeStatus(ch);
        const title = challengeTitle(ch);
        const desc = challengeDescription(ch);
        const cat = categoryMeta(ch.category);
        const cover = ch.cover_image || entryThumb(slide.topEntries[0]) || FALLBACK_HERO;
        const detailPath = `/challenges/${ch.id}`;
        // All hero CTAs land on the challenge intro page first.
        const submitPath = detailPath;
        const votePath = detailPath;

        const eyebrow = status ? status.label : "Featured Challenge";

        let metaParts = [];
        if (phase === "submit" && ch.submission_ends_at) {
          const left = daysLeft(ch.submission_ends_at);
          metaParts.push(left > 0 ? `Entries close in ${left} day${left === 1 ? "" : "s"}` : "Entries closing soon");
        } else if (phase === "vote" && ch.voting_ends_at) {
          const left = daysLeft(ch.voting_ends_at);
          metaParts.push(left > 0 ? `Voting ends in ${left} day${left === 1 ? "" : "s"}` : "Voting closing soon");
        }
        if (cat && cat.name) metaParts.push(cat.name);

        const primaryCta =
          phase === "vote"
            ? { label: "Watch & Vote", to: votePath }
            : phase === "upcoming"
            ? { label: "View Details", to: detailPath }
            : isOpenForEntries(ch)
            ? { label: "Enter Challenge", to: submitPath }
            : { label: "View Details", to: detailPath };

        // Countdown target — pick the next future deadline regardless of
        // phase label, so the timer shows whenever any date is still ahead.
        const nowMs = Date.now();
        const subEnd = ch.submission_ends_at || ch.end_date;
        const voteEnd = ch.voting_ends_at || ch.voting_end_date;
        const startAt = ch.starts_at || ch.start_date;
        let countdownTarget = "";
        let countdownLabel = "";
        if (subEnd && new Date(subEnd).getTime() > nowMs) {
          countdownTarget = subEnd;
          countdownLabel = "Entries Close In";
        } else if (voteEnd && new Date(voteEnd).getTime() > nowMs) {
          countdownTarget = voteEnd;
          countdownLabel = "Voting Ends In";
        } else if (startAt && new Date(startAt).getTime() > nowMs) {
          countdownTarget = startAt;
          countdownLabel = "Entries Open In";
        }

        const isActive = idx === current;

        return (
          <div
            key={ch.id}
            className="hero-slide absolute inset-0"
            style={{ opacity: isActive ? 1 : 0, pointerEvents: isActive ? "auto" : "none", transition: "opacity 0.8s ease", zIndex: isActive ? 10 : 0 }}
          >
            {/* Cover image background */}
            <div className="absolute inset-0">
              <img src={cover} alt="" className="h-full w-full object-cover" />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 45%, transparent 100%)",
                }}
              />
            </div>

            {/* Content */}
            <div className="relative z-10 mx-auto flex h-full max-w-7xl items-center px-6">
              {/* Left — challenge text */}
              <div className="max-w-xl pt-10">
                <span
                  className="c53-hero-in inline-block rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-widest text-white/90"
                  style={{ borderColor: "rgba(255,255,255,0.35)" }}
                >
                  {eyebrow}
                </span>
                <h1 className="c53-hero-in mt-4 text-4xl font-extrabold leading-tight text-white sm:text-5xl" style={{ animationDelay: "120ms" }}>
                  {title}
                </h1>
                {desc && (
                  <p className="c53-hero-in mt-2 line-clamp-2 max-w-lg text-base text-white/80" style={{ animationDelay: "260ms" }}>
                    {desc}
                  </p>
                )}

                {metaParts.length > 0 && (
                  <div className="c53-hero-in mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/85" style={{ animationDelay: "360ms" }}>
                    {metaParts.map((m, i) => (
                      <React.Fragment key={m}>
                        {i > 0 && <span className="text-white/40">•</span>}
                        <span style={i === 0 ? { color: GOLD } : undefined}>{m}</span>
                      </React.Fragment>
                    ))}
                  </div>
                )}

                <div className="c53-hero-in mt-6 flex flex-wrap items-center gap-3" style={{ animationDelay: "460ms" }}>
                  <Link
                    to={primaryCta.to}
                    style={{ backgroundColor: RED }}
                    className="rounded-md px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    {primaryCta.label}
                  </Link>
                  {phase !== "vote" && (
                    <Link
                      to={votePath}
                      className="flex items-center gap-2 rounded-md border px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                      style={{ borderColor: TEAL }}
                    >
                      <Play size={15} style={{ color: TEAL }} fill={TEAL} />
                      Watch &amp; Vote
                    </Link>
                  )}
                  <Link to={detailPath} className="flex items-center gap-1 border-b border-white/60 pb-1 text-sm font-semibold text-white">
                    View <ChevronRight size={15} />
                  </Link>
                </div>

                {/* Countdown timer (or "Challenge Ended" for closed challenges) */}
                {countdownTarget ? (
                  <HeroCountdown target={countdownTarget} label={countdownLabel} />
                ) : (
                  <div className="c53-hero-in mt-4 flex items-center gap-2" style={{ animationDelay: "520ms" }}>
                    <Clock size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
                    <span className="text-xs font-bold uppercase tracking-widest text-white/40">
                      Challenge Ended
                    </span>
                  </div>
                )}
              </div>

              {/* Right — entries collage (desktop) */}
              {slide.topEntries.length > 0 && (
                <div className="c53-hero-in ml-auto hidden w-[340px] shrink-0 flex-col gap-2.5 lg:flex" style={{ animationDelay: "300ms" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-white/70">Community Entries</p>
                    <Link to={detailPath} className="flex items-center gap-0.5 text-xs font-semibold text-white/80 hover:text-white">
                      View all <ChevronRight size={12} />
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {slide.topEntries.map((e, ei) => {
                      const thumb = entryThumb(e);
                      const isVideo = e.media_type === "video" || isVideoUrl(e.work_url);
                      return (
                        <Link
                          key={e.id || ei}
                          to={`/challenges/${ch.id}?entry=${e.id}`}
                          className="group relative overflow-hidden rounded-xl border border-white/15 bg-black/40 backdrop-blur-sm transition hover:border-white/50 hover:-translate-y-0.5"
                        >
                          <div className="relative h-[88px]">
                            {thumb ? (
                              <img src={thumb} alt={e.title || ""} className="h-full w-full object-cover" />
                            ) : (
                              <div
                                className="relative flex h-full w-full flex-col justify-between overflow-hidden p-2"
                                style={{
                                  background: "linear-gradient(135deg, #FBF6EE 0%, #F5E9D4 55%, #EFD9BA 100%)",
                                  borderTop: "2px solid #FF8C00",
                                }}
                              >
                                <span className="pointer-events-none absolute left-1 top-0 font-serif leading-none text-[#CC7A29]/50" style={{ fontFamily: 'Georgia, serif', fontSize: '1.6rem' }}>“</span>
                                <p className="z-10 line-clamp-3 px-3 text-center font-serif text-[9px] leading-tight text-[#2a2230]" style={{ fontFamily: 'Georgia, serif' }}>
                                  {e.work_text || e.description || e.title || "Untitled entry"}
                                </p>
                                <span className="pointer-events-none absolute bottom-0 right-1 font-serif leading-none text-[#CC7A29]/50" style={{ fontFamily: 'Georgia, serif', fontSize: '1.6rem' }}>”</span>
                                <p className="z-10 truncate text-center text-[9px] italic text-[#CC7A29]" style={{ fontFamily: 'Georgia, serif' }}>— {e.creator_name || e.user_name || "Anonymous"}</p>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                            {isVideo && (
                              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5">
                                <Play size={14} className="text-white" fill="white" />
                              </span>
                            )}
                          </div>
                          {thumb && (
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <p className="truncate text-[11px] font-semibold text-white">{e.title || "Untitled entry"}</p>
                            <div className="flex items-center justify-between">
                              <p className="truncate text-[10px] text-white/60">{e.creator_name || e.user_name || "Anonymous"}</p>
                              <span className="flex shrink-0 items-center gap-0.5" style={{ color: RED }}>
                                <Heart size={9} fill={RED} />
                                <span className="text-[10px] font-bold text-white">{e.vote_count || 0}</span>
                              </span>
                            </div>
                          </div>
                          )}
                          {!thumb && (
                            <span className="absolute right-1.5 top-1.5 flex shrink-0 items-center gap-0.5 rounded-full bg-black/30 px-1.5 py-0.5" style={{ color: RED }}>
                              <Heart size={9} fill={RED} />
                              <span className="text-[9px] font-bold text-white">{e.vote_count || 0}</span>
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mobile — horizontal strip of entries */}
              {slide.topEntries.length > 0 && (
                <div className="absolute bottom-4 left-0 right-0 flex gap-2 overflow-x-auto px-6 lg:hidden scrollbar-hide">
                  {slide.topEntries.map((e, ei) => {
                    const thumb = entryThumb(e);
                    const isVideo = e.media_type === "video" || isVideoUrl(e.work_url);
                    return (
                      <Link
                        key={`m-${e.id || ei}`}
                        to={`/challenges/${ch.id}?entry=${e.id}`}
                        className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-white/20"
                      >
                        {thumb ? (
                          <img src={thumb} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-white/10" />
                        )}
                        <span className="absolute bottom-0 right-0 flex items-center gap-0.5 bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          <Heart size={9} fill={RED} style={{ color: RED }} /> {e.vote_count || 0}
                        </span>
                        {isVideo && (
                          <Play size={14} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white" fill="white" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* ── Carousel indicators ──────────────────────────────────────── */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2 lg:bottom-6">
          {slides.map((s, i) => (
            <button
              key={s.challenge.id}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === current ? 28 : 10,
                backgroundColor: i === current ? RED : "rgba(255,255,255,0.4)",
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}