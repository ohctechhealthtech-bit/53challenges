import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Trophy,
  Users,
  Landmark,
  ChevronRight,
} from "lucide-react";
import FeaturedChallengesGrid from "@/components/home/FeaturedChallengesGrid";
import ActiveChallengeBanner from "@/components/challenges/ActiveChallengeBanner";
import StatePartnerSection from "@/components/home/StatePartnerSection";
import ActivityGrid from "@/components/home/ActivityGrid";


/**
 * 53 Challenges — Home Page
 * Dark-themed landing page matching the brand design.
 */

// Brand colours
const RED = "#ff3b3b";
const TEAL = "#00d1c1";
const GOLD = "#ffce54";
const NAVY = "#ffffff";
const PANEL = "#f1f5f9";

const PARTICIPATE = [
  { icon: Trophy, color: RED, title: "Compete", sub: "Find your challenge", to: "/challenges", bg: "#fef2f2", border: "#fecaca" },
  { icon: Users, color: TEAL, title: "Watch & Vote", sub: "Support creators", to: "/challenges?phase=vote", bg: "#f0fdfa", border: "#99f6e4" },
  { icon: Landmark, color: GOLD, title: "Host or Sponsor", sub: "Run a challenge", to: "/run-a-challenge", bg: "#fffbeb", border: "#fde68a" },
];

const LEADERBOARD = [
  { rank: 1, state: "VIC", pts: "12,450 pts", highlight: GOLD },
  { rank: 2, state: "NSW", pts: "10,215 pts" },
  { rank: 3, state: "QLD", pts: "8,760 pts", highlight: "#B06A3B" },
];

const PARTNER = [
  {
    icon: Trophy,
    color: RED,
    title: "Sponsor a Challenge",
    body: "Align your brand with purpose and communities Australia-wide.",
    link: "Explore Sponsorships",
    linkColor: RED,
    to: "/run-a-challenge",
  },
  {
    icon: () => <span className="text-white text-xl">⚑</span>,
    color: TEAL,
    title: "Host a Challenge",
    body: "Run your own competition with our trusted platform and support.",
    link: "Learn More",
    linkColor: TEAL,
    to: "/host-a-challenge",
  },
  {
    icon: Users,
    color: GOLD,
    title: "Managed by 53",
    body: "We manage it all—promotion, entries, judging and engagement.",
    link: "Request a Proposal",
    linkColor: GOLD,
    to: "/run-a-challenge",
  },
];

export default function Home() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll("[data-reveal], [data-stagger]"));
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="font-sans text-slate-900" style={{ backgroundColor: NAVY }}>
      <style>{[
        // Fade up
        "@keyframes c53FadeUp { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: translateY(0); } }",
        // Slide from left
        "@keyframes c53SlideLeft { from { opacity: 0; transform: translateX(-50px); } to { opacity: 1; transform: translateX(0); } }",
        // Slide from right
        "@keyframes c53SlideRight { from { opacity: 0; transform: translateX(50px); } to { opacity: 1; transform: translateX(0); } }",
        // Pop / scale in
        "@keyframes c53PopIn { 0% { opacity: 0; transform: scale(0.8); } 60% { opacity: 1; transform: scale(1.04); } 100% { opacity: 1; transform: scale(1); } }",
        // Fade only
        "@keyframes c53Fade { from { opacity: 0; } to { opacity: 1; } }",
        // Base hidden state
        "[data-reveal] { opacity: 0; }",
        "[data-reveal='up'] { opacity: 0; }",
        "[data-reveal='left'] { opacity: 0; }",
        "[data-reveal='right'] { opacity: 0; }",
        "[data-reveal='pop'] { opacity: 0; }",
        "[data-reveal='fade'] { opacity: 0; }",
        // Visible animations
        "[data-reveal].is-visible { animation: c53FadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }",
        "[data-reveal='up'].is-visible { animation: c53FadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }",
        "[data-reveal='left'].is-visible { animation: c53SlideLeft 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }",
        "[data-reveal='right'].is-visible { animation: c53SlideRight 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }",
        "[data-reveal='pop'].is-visible { animation: c53PopIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }",
        "[data-reveal='fade'].is-visible { animation: c53Fade 1s ease forwards; }",
        // Staggered children inside a stagger container
        "[data-stagger] > * { opacity: 0; }",
        "[data-stagger].is-visible > *:nth-child(1) { animation: c53FadeUp 0.6s cubic-bezier(0.22,1,0.36,1) 0ms forwards; }",
        "[data-stagger].is-visible > *:nth-child(2) { animation: c53SlideLeft 0.6s cubic-bezier(0.22,1,0.36,1) 100ms forwards; }",
        "[data-stagger].is-visible > *:nth-child(3) { animation: c53SlideRight 0.6s cubic-bezier(0.22,1,0.36,1) 200ms forwards; }",
        "[data-stagger].is-visible > *:nth-child(4) { animation: c53PopIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 300ms forwards; }",
        "[data-stagger].is-visible > *:nth-child(5) { animation: c53FadeUp 0.6s cubic-bezier(0.22,1,0.36,1) 400ms forwards; }",
        "[data-stagger].is-visible > *:nth-child(6) { animation: c53SlideLeft 0.6s cubic-bezier(0.22,1,0.36,1) 500ms forwards; }",
        // Special color glow effect on cards
        "@keyframes c53ColorGlow { 0% { box-shadow: 0 0 0 0 rgba(255,59,59,0); } 50% { box-shadow: 0 0 24px 4px rgba(255,59,59,0.25); } 100% { box-shadow: 0 12px 32px -8px rgba(255,59,59,0.3); } }",
        ".c53-glow-card { transition: transform 0.35s cubic-bezier(0.22,1,0.36,1), box-shadow 0.35s ease, border-color 0.35s ease; }",
        ".c53-glow-card:hover { transform: translateY(-6px); animation: c53ColorGlow 0.6s ease forwards; }",
        // Gradient shimmer border
        "@keyframes c53Shimmer { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }",
        ".c53-shimmer-text { background: linear-gradient(90deg, #ff3b3b, #00d1c1, #ffce54, #ff3b3b); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: c53Shimmer 4s linear infinite; }",
        // Button micro-interactions (scale + shadow lift on hover, depress on active)
        ".c53-btn-primary { transition: transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s ease, filter 0.25s ease; box-shadow: 0 10px 24px -8px rgba(255,59,59,0.5); }",
        ".c53-btn-primary:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 16px 32px -8px rgba(255,59,59,0.6); filter: brightness(1.05); }",
        ".c53-btn-primary:active { transform: translateY(0) scale(0.98); }",
        ".c53-btn-ghost { transition: transform 0.25s cubic-bezier(0.22,1,0.36,1), background-color 0.25s ease, border-color 0.25s ease; }",
        ".c53-btn-ghost:hover { transform: translateY(-2px); background-color: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.5); }",
        ".c53-btn-ghost:active { transform: translateY(0) scale(0.98); }",
        // Card image zoom on hover (applies to any .c53-zoom-img container)
        ".c53-zoom-img img { transition: transform 0.3s cubic-bezier(0.22,1,0.36,1); }",
        ".c53-zoom-img:hover img { transform: scale(1.06); }",
        // Icon micro-interaction — subtle rotate on hover
        ".c53-icon-hover { transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1); }",
        ".c53-icon-hover:hover { transform: rotate(-8deg) scale(1.12); }",
        "@media (prefers-reduced-motion: reduce) { [data-reveal], [data-stagger] > * { opacity: 1 !important; animation: none !important; } .c53-glow-card:hover, .c53-btn-primary:hover, .c53-btn-ghost:hover, .c53-zoom-img:hover img, .c53-icon-hover:hover { transform: none !important; animation: none !important; } .c53-shimmer-text { animation: none !important; } }",
      ].join("\n")}</style>

      {/* ===================== ACTIVE CHALLENGE BANNER ===================== */}
      <ActiveChallengeBanner />

      {/* ===================== SERVICE CARDS ===================== */}
      <section className="border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4">
          <div data-stagger className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {PARTICIPATE.map((p) => {
              const Icon = p.icon;
              return (
                <Link
                  key={p.title}
                  to={p.to}
                  style={{ backgroundColor: p.bg, borderColor: p.border }}
                  className="c53-glow-card group flex items-center gap-4 rounded-2xl border px-5 py-4"
                >
                  <span
                    style={{ backgroundColor: p.color }}
                    className="c53-icon-hover flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                  >
                    <Icon size={22} className="c53-icon-wiggle text-white" />
                  </span>
                  <div>
                    <p className="font-bold text-slate-900">{p.title}</p>
                    <span className="flex items-center text-sm text-slate-500">
                      {p.sub} <ChevronRight size={14} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== FEATURED CHALLENGES ===================== */}
      <section className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4">
        <div data-reveal="left" className="mb-3 flex items-end justify-between">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Featured <span className="c53-shimmer-text">challenges</span>
          </h2>
          <Link
            to="/challenges"
            className="flex items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            View all <ChevronRight size={16} />
          </Link>
        </div>
        <div data-reveal="right">
          <FeaturedChallengesGrid />
        </div>
      </section>

      {/* ===================== EXPLORE BY ACTIVITY ===================== */}
      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 sm:pb-5">
        <h2 data-reveal="right" className="mb-2 text-xl font-extrabold tracking-tight text-slate-900 sm:mb-3 sm:text-2xl">
          Explore by <span className="c53-shimmer-text">activity</span>
        </h2>
        <div data-reveal="pop">
          <ActivityGrid />
        </div>
      </section>

      {/* ===================== LEADERBOARD + PARTNER (combined) ===================== */}
      <StatePartnerSection />

    </div>
  );
}