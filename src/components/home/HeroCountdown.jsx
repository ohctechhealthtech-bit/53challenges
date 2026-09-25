import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";

const RED = "#F04E37";
const GOLD = "#E8A73B";

function pad(n) {
  return String(n).padStart(2, "0");
}

function getRemaining(target) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, done: true };
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, done: false };
}

/**
 * Compact live countdown timer for the hero banner. Shows days/hours/minutes/
 * seconds remaining until the challenge's submission or voting deadline.
 */
export default function HeroCountdown({ target, label, variant = "light" }) {
  const [time, setTime] = useState(() => getRemaining(target));

  useEffect(() => {
    setTime(getRemaining(target));
    const id = setInterval(() => setTime(getRemaining(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!target || time.done) return null;

  const blocks = [
    { v: time.d, l: "Days" },
    { v: time.h, l: "Hrs" },
    { v: time.m, l: "Min" },
    { v: time.s, l: "Sec" },
  ];

  const isDark = variant === "dark";

  return (
    <div className="c53-hero-in mt-4 flex flex-col gap-2" style={{ animationDelay: "520ms" }}>
      {label && (
        <div className="flex items-center gap-2">
          <Clock size={14} style={{ color: GOLD }} className="animate-pulse" />
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: GOLD }}
          >
            {label}
          </span>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        {blocks.map((b, i) => (
          <React.Fragment key={b.l}>
            <div
              className="flex min-w-[44px] flex-col items-center rounded-lg px-2 py-1 backdrop-blur-sm sm:min-w-[52px] sm:px-3 sm:py-1.5"
              style={{
                backgroundColor: isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.12)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.25)"}`,
              }}
            >
              <span
                className="text-lg font-extrabold tabular-nums text-white sm:text-xl"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {pad(b.v)}
              </span>
              <span className="text-[8px] font-semibold uppercase tracking-wider text-white/60 sm:text-[9px]">
                {b.l}
              </span>
            </div>
            {i < blocks.length - 1 && (
              <span className="text-base font-bold text-white/40">:</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}