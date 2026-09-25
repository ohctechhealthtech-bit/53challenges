import { Link } from 'react-router-dom';
import { Building2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import RevealOnScroll from '@/components/home/RevealOnScroll';

const PERKS = [
  { title: 'Reach a creative audience', desc: 'Put your brand in front of thousands of active Australian creators and voters.' },
  { title: 'We manage the whole run', desc: 'From brief and marketing to judging and prizes — our team runs it end to end.' },
  { title: 'Sponsored challenge branding', desc: 'Your challenge is tagged as sponsored and featured across discovery surfaces.' },
];

export default function HostAChallengeSection() {
  return (
    <RevealOnScroll as="section" variant="zoom" className="container-tight py-16">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 text-accent" /> For Brands & Partners
          </div>
          <h2 className="mt-4 font-heading text-3xl font-extrabold text-balance sm:text-4xl">
            Want to list a <span className="grad-text">challenge</span> with us?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            We help companies and communities run their own challenges — from concept and marketing to judging and prizes. Send us a proposal and we'll shape it together.
          </p>
          <ul className="mt-6 space-y-3">
            {PERKS.map((p) => (
              <motion.li key={p.title} whileHover={{ x: 4 }} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full grad-bg" />
                <div>
                  <p className="font-semibold text-foreground">{p.title}</p>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                </div>
              </motion.li>
            ))}
          </ul>
          <Link
            to="/host-a-challenge"
            className="btn-glow btn-bounce mt-8 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold text-white transition hover:border-primary hover:text-primary hover:-translate-y-0.5"
          >
            Contact us to host a challenge <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-purple-600/20 to-pink-600/20 blur-2xl" />
          <div className="rounded-[2rem] border border-border bg-card/60 p-8">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">How it works</p>
            <RevealOnScroll stagger as="ol" className="mt-4 space-y-4">
              {[
                { n: '1', t: 'You send a proposal', d: 'Tell us your theme, audience and budget.' },
                { n: '2', t: 'We shape it together', d: 'We align on brief, prizes and timeline.' },
                { n: '3', t: 'We run the challenge', d: 'Marketing, entries, voting and judging.' },
                { n: '4', t: 'Winners announced', d: 'You get the spotlight, creators get rewarded.' },
              ].map((s) => (
                <li key={s.n} className="flex gap-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl grad-bg text-sm font-bold text-white">{s.n}</span>
                  <div>
                    <p className="font-semibold text-foreground">{s.t}</p>
                    <p className="text-sm text-muted-foreground">{s.d}</p>
                  </div>
                </li>
              ))}
            </RevealOnScroll>
          </div>
        </div>
      </div>
    </RevealOnScroll>
  );
}