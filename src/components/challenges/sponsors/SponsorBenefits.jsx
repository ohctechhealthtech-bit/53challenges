import React from 'react';
import { Megaphone, Trophy, BarChart3, Heart, Palette, ShieldCheck } from 'lucide-react';

const BENEFITS = [
  { icon: Megaphone, title: 'Front-and-centre visibility', text: 'Your brand on the challenge page, every entry, the voting pages and the winner announcement.' },
  { icon: Trophy, title: 'Prizes with meaning', text: 'Back a prize, a category or an entire season — and be there for the moment someone wins.' },
  { icon: Palette, title: 'We build it with you', text: 'Our team shapes the theme, rules, artwork and timeline around your goals. You approve, we run it.' },
  { icon: BarChart3, title: 'Reporting you can use', text: 'Entries, votes, reach and audience insight, reported back to you after every challenge.' },
  { icon: ShieldCheck, title: 'Independent judging', text: 'Blind scoring against a published rubric, with conflicts declared — results everyone trusts.' },
  { icon: Heart, title: 'Real community goodwill', text: 'Support creativity in schools, clubs and communities — not just another ad placement.' },
];

const STEPS = [
  { n: '1', title: 'Tell us your idea', text: 'One short form — your goals, audience and rough budget.' },
  { n: '2', title: 'We shape the challenge', text: 'Our partnerships team comes back with a plan, prizes and timeline.' },
  { n: '3', title: 'Go live', text: 'We launch, moderate, judge and report. You get the spotlight.' },
];

export default function SponsorBenefits() {
  return (
    <>
      <section id="why-sponsor" className="py-16 md:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-extrabold text-stone-900">Why brands sponsor a 53 Challenge</h2>
            <p className="mt-3 text-stone-600 max-w-2xl mx-auto">
              Everything below is included when you run a challenge with us.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="group rounded-2xl border border-stone-200 bg-stone-50/60 p-6 transition hover:-translate-y-1 hover:border-orange-200 hover:bg-white hover:shadow-xl hover:shadow-orange-900/5"
              >
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-orange-100 text-orange-600 transition group-hover:bg-orange-600 group-hover:text-white">
                  <b.icon className="w-5 h-5" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-stone-900">{b.title}</h3>
                <p className="mt-2 text-sm text-stone-600 leading-relaxed">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-b from-stone-900 to-stone-800 text-white">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-extrabold text-center">How it works</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-white/10 bg-white/5 p-7">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-amber-300 text-lg font-extrabold text-stone-900">
                  {s.n}
                </span>
                <h3 className="mt-4 text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-stone-300 text-sm leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}