import { Link } from 'react-router-dom';
import {
  Handshake,
  Building2,
  Wand2,
  Gavel,
  Briefcase,
  Heart,
  ArrowRight,
  CheckCircle2,
  Phone,
} from 'lucide-react';
import RevealOnScroll from '@/components/home/RevealOnScroll';
import { StaggerGrid, StaggerItem } from '@/components/motion/StaggerGrid';

const ORG_CARDS = [
  {
    icon: Handshake,
    title: 'Sponsor a Challenge',
    body: 'Align your brand with purpose and reach thousands of active Australian creators.',
    cta: 'Explore Sponsorships',
    to: '/run-a-challenge',
  },
  {
    icon: Building2,
    title: 'Host Your Competition',
    body: 'Run your own competition with our platform — entries, voting and judging handled.',
    cta: 'Learn More',
    to: '/host-a-challenge',
  },
  {
    icon: Wand2,
    title: 'Fully Managed by 53 Challenges',
    body: "We manage it all — promotion, entries, judging and engagement. You bring the idea.",
    cta: 'Request a Proposal',
    to: '/run-a-challenge',
  },
];

const BENEFITS = [
  'Branded challenge pages with your logo and messaging',
  'Audience growth through built-in community voting',
  'Transparent, audited results you can trust',
  'Nationwide reach across six creative categories',
];

const STEPS = [
  { num: '01', title: 'Discovery', body: 'Share your goals, audience and timeline.' },
  { num: '02', title: 'Design', body: 'We craft the challenge format and prize structure.' },
  { num: '03', title: 'Launch', body: 'Your challenge goes live with full promotion.' },
  { num: '04', title: 'Results', body: 'Audited winners and a full engagement report.' },
];

export default function OrganisationsSection() {
  return (
    <RevealOnScroll as="section" className="container-tight py-14 lg:py-16">
      {/* Header */}
      <div className="mb-10 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">For Organisations</p>
        <h2 className="mt-2 font-heading text-3xl font-bold text-balance sm:text-4xl">
          Turn your audience into active participants.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Partner with Australia's leading competition platform to engage your community.
        </p>
      </div>

      {/* Three organisation cards */}
      <StaggerGrid className="grid gap-5 sm:grid-cols-3">
        {ORG_CARDS.map((c) => (
          <StaggerItem key={c.title}>
            <div className="card-lift flex h-full flex-col rounded-2xl border border-border bg-card p-6">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
                <c.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-heading text-lg font-bold">{c.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{c.body}</p>
              <Link
                to={c.to}
                className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
              >
                {c.cta} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </StaggerItem>
        ))}
      </StaggerGrid>

      {/* Benefits + Process */}
      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        {/* Benefits */}
        <div className="rounded-2xl border border-border bg-card p-7">
          <h3 className="font-heading text-xl font-bold">Why partner with us</h3>
          <ul className="mt-4 space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* 4-step process */}
        <div className="rounded-2xl border border-border bg-card p-7">
          <h3 className="font-heading text-xl font-bold">How it works</h3>
          <div className="mt-4 space-y-4">
            {STEPS.map((s) => (
              <div key={s.num} className="flex items-start gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-sm font-extrabold text-primary">
                  {s.num}
                </span>
                <div>
                  <p className="font-heading text-sm font-bold">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Case study area */}
      <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Case Studies</p>
        <p className="mt-2 text-muted-foreground">
          Real results from organisations who've run challenges with us will appear here.
        </p>
        <Link
          to="/contact-us"
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary"
        >
          Share Your Story <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* CTAs */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/contact-us"
          className="btn-bounce btn-glow inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5 hover:brightness-110"
        >
          <Phone className="h-4 w-4" /> Book a Discovery Call
        </Link>
        <Link
          to="/run-a-challenge"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3.5 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary"
        >
          Request a Proposal <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Other ways to join */}
      <div className="mt-10 border-t border-border pt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Other ways to join</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill to="/become-a-judge" icon={Gavel} label="Become a Judge" />
          <Pill to="/ecosystem" icon={Briefcase} label="Jobs & Opportunities" />
          <Pill to="/run-a-challenge" icon={Heart} label="Volunteer or Partner" />
        </div>
      </div>
    </RevealOnScroll>
  );
}

function Pill({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary"
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}