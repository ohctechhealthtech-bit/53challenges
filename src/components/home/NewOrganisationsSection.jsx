import { Link } from 'react-router-dom';
import {
  Handshake,
  Building2,
  Wand2,
  Gavel,
  Briefcase,
  Heart,
  ArrowRight,
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
    accent: '#ff4d4d',
  },
  {
    icon: Building2,
    title: 'Host Your Competition',
    body: 'Run your own competition with our platform \u2014 entries, voting and judging handled.',
    cta: 'Learn More',
    to: '/host-a-challenge',
    accent: '#14b8a6',
  },
  {
    icon: Wand2,
    title: 'Managed by 53 Challenges',
    body: 'We manage it all \u2014 promotion, entries, judging and engagement. You bring the idea.',
    cta: 'Request a Proposal',
    to: '/run-a-challenge',
    accent: '#facc15',
  },
];

/**
 * "Turn your audience into active participants" — three org cards with
 * red / teal / gold accent icons, plus sidebar "Other ways to join" links.
 */
export default function NewOrganisationsSection() {
  return (
    <RevealOnScroll as="section" className="container-tight py-14 lg:py-16">
      <div className="mb-10 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">For Organisations</p>
        <h2 className="mt-2 font-heading text-3xl font-bold text-balance sm:text-4xl">
          Turn your audience into active participants.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Partner with Australia's leading competition platform to engage your community.
        </p>
      </div>

      <StaggerGrid className="grid gap-5 sm:grid-cols-3">
        {ORG_CARDS.map((c) => (
          <StaggerItem key={c.title}>
            <div className="card-lift flex h-full flex-col rounded-2xl border border-border bg-card p-6">
              <span
                className="grid h-12 w-12 place-items-center rounded-xl"
                style={{ backgroundColor: c.accent + '22', color: c.accent }}
              >
                <c.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-heading text-lg font-bold">{c.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{c.body}</p>
              <Link
                to={c.to}
                className="mt-4 inline-flex items-center gap-1 text-sm font-bold transition hover:underline"
                style={{ color: c.accent }}
              >
                {c.cta} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </StaggerItem>
        ))}
      </StaggerGrid>

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