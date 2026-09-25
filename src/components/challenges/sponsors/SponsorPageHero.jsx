import React from 'react';
import { Handshake, Sparkles, ArrowDown } from 'lucide-react';

const STATS = [
  { value: '8', label: 'Creative categories' },
  { value: '8', label: 'States & territories' },
  { value: '100%', label: 'Independently judged' },
];

export default function SponsorPageHero({ onStart }) {
  return (
    <section className="relative overflow-hidden bg-stone-900 text-white">
      <img
        src="https://images.unsplash.com/photo-1531058020387-3be344556be6?w=1600&q=80"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-stone-950 via-stone-900/85 to-orange-900/60" />

      <div className="relative max-w-5xl mx-auto px-6 py-20 md:py-28 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider backdrop-blur">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Partner with 53 Challenges
        </span>

        <h1 className="mt-6 text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
          Put your brand behind
          <span className="block bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent">
            Australia's next big idea
          </span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-stone-200 max-w-2xl mx-auto">
          Brands, councils, schools and not-for-profits launch creative challenges with us — reaching
          thousands of makers, students and communities, with prizes that change what happens next.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onStart}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-8 py-3.5 font-bold text-white shadow-xl shadow-orange-900/40 transition hover:-translate-y-0.5 hover:bg-orange-500"
          >
            <Handshake className="w-4 h-4" /> Start your enquiry
          </button>
          <a
            href="#why-sponsor"
            className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-7 py-3.5 font-bold text-white backdrop-blur transition hover:bg-white/15"
          >
            See what's included <ArrowDown className="w-4 h-4" />
          </a>
        </div>

        <div className="mt-14 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/15 bg-white/5 px-4 py-5 backdrop-blur">
              <p className="text-2xl md:text-3xl font-extrabold text-amber-300">{s.value}</p>
              <p className="mt-1 text-xs md:text-sm text-stone-300">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}