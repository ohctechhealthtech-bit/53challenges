/**
 * Portal Manual — full guide to the /host-a-challenge marketplace:
 * page anatomy, packages, wizard form, deposits, workspace, and access.
 */
import { Link } from 'react-router-dom';
import { Check, ArrowRight, CreditCard } from 'lucide-react';
import { HOST_PACKAGES } from '@/lib/hostPackages';
import { HOST_ADDONS } from '@/lib/hostAddons';
import HostWorkflowDiagram from '@/components/manual/HostWorkflowDiagram';
import HostAccessMatrix from '@/components/manual/HostAccessMatrix';

const PAGE_ANATOMY = [
  { t: 'Hero', d: '"For organisations" badge, headline, and the promise: you configure your edition, we build and run the live challenge.' },
  { t: 'Hosting packages', d: 'Three cards — Self-service, Supported (Most popular), Fully managed — each deep-linking into the wizard with that package pre-selected.' },
  { t: 'Two pathways', d: 'Adopt a Curated Challenge (library coming soon) or Propose a Custom Challenge, plus a cost estimator link.' },
  { t: 'What we manage', d: 'Compliance & rules, judging & voting integrity, promotion & reporting.' },
];

const WIZARD_STEPS = [
  'Who are you running this challenge for? — Just me / A business or brand / A school or community group',
  'How much help would you like? — Self-service, Supported, or Fully managed',
  "What's your challenge about? — challenge name (required) and short description",
  'What kind of entries? — visual arts, photography, writing, digital creativity, performance & voice, open & experimental',
  'How many participants? — rough range bands',
  'How is the winner decided? — public voting, judge panel, or hybrid',
  'Who can enter? — multi-select age divisions',
  'One-off, series, or annual program?',
  'Any extra services? — the add-on picker below',
  'Confirm and pay your deposit — summary plus in-page card fields (paid packages only)',
];

const WORKSPACE_TABS = [
  { t: 'Overview', d: 'Read-only summary, plain-English status, what happens next, and any note from our team.' },
  { t: 'Details', d: 'Editable proposal form — title, description, participants, entry type, winner method, divisions, add-ons.' },
  { t: 'Team', d: 'Invite colleagues by email and assign a role.' },
];

const STATUSES = [
  { label: 'Submitted / In review', tone: 'blue', d: 'We’re checking your challenge.' },
  { label: 'Action needed / Changes requested', tone: 'amber', d: 'Something needs your input before it can go ahead.' },
  { label: 'Agreement ready', tone: 'amber', d: 'Review and sign the terms.' },
  { label: 'Approved / Live', tone: 'emerald', d: 'Ready to go live, or already running.' },
  { label: 'Declined', tone: 'red', d: 'We can’t run this challenge — with a written reason.' },
];

const TONE_CLASS = {
  blue: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  red: 'border-red-500/30 bg-red-500/10 text-red-300',
};

function Block({ title, children }) {
  return (
    <div>
      <p className="font-heading text-sm font-bold text-foreground">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function HostMarketplaceGuide() {
  return (
    <div className="space-y-7 text-sm text-muted-foreground">
      <p>
        <Link to="/host-a-challenge" className="text-primary hover:underline">Host a Challenge</Link> is the
        self-operating marketplace where an organisation picks a package, answers a short guided form, pays a deposit,
        and then manages their challenge in a shared workspace while our team reviews and launches it.
      </p>

      <Block title="End-to-end workflow">
        <HostWorkflowDiagram />
      </Block>

      <Block title="What's on the page">
        <ol className="space-y-2">
          {PAGE_ANATOMY.map((s, i) => (
            <li key={s.t} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/15 text-xs font-bold text-primary">{i + 1}</span>
              <div><p className="font-semibold text-foreground">{s.t}</p><p className="text-xs">{s.d}</p></div>
            </li>
          ))}
        </ol>
      </Block>

      <Block title="The three hosting packages">
        <div className="grid gap-3 lg:grid-cols-3">
          {HOST_PACKAGES.map((p) => (
            <div key={p.key} className={`rounded-2xl border p-4 ${p.highlight ? 'border-primary bg-secondary' : 'border-border bg-card'}`}>
              <div className="flex items-center gap-2">
                <p className="font-heading text-base font-bold text-foreground">{p.name}</p>
                {p.badge && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.highlight ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {p.badge}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs font-semibold text-primary">{p.tagline}</p>
              <p className="mt-3 font-heading text-xl font-extrabold text-foreground">{p.price}</p>
              <p className="text-[11px]">{p.priceNote}</p>
              <p className="mt-2 rounded-lg border border-border bg-white/5 px-2 py-1.5 text-[11px]">{p.audience}</p>
              <ul className="mt-3 space-y-1.5">
                {p.benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    {b.endsWith('plus:') ? (
                      <span className="font-semibold">{b}</span>
                    ) : (
                      <>
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
                        <span>{b}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Block>

      <Block title="The apply form (guided wizard)">
        <p className="text-xs">
          One question per screen with a progress bar and a five-stage checklist (Apply → Review → Agreement → Approval →
          Go live). Recommended answers are pre-suggested from earlier choices, so a host can accept the defaults and
          finish in about three minutes. Plain-language answers are mapped silently into the platform's internal
          configuration — hosts never see technical terminology.
        </p>
        <ol className="mt-3 space-y-1.5">
          {WIZARD_STEPS.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-xs">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-primary/15 text-[10px] font-bold text-primary">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </Block>

      <Block title="Add-on services a host can request">
        <div className="grid gap-2 sm:grid-cols-2">
          {HOST_ADDONS.map((a) => (
            <div key={a.key} className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs font-semibold text-foreground">{a.name}</p>
              <p className="text-xs">{a.description}</p>
            </div>
          ))}
        </div>
      </Block>

      <Block title="Deposits & payment">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CreditCard className="h-4 w-4 text-primary" /> Card payment inside the final wizard step — no redirect.
          </p>
          <ul className="mt-2 space-y-1.5 text-xs">
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> Supported A$149, Fully managed A$299, refundable and credited against the final cost.</li>
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> Self-service requires no deposit and submits straight away.</li>
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> The amount and label are decided server-side from the chosen package — never trusted from the browser.</li>
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> The proposal is only sent once payment succeeds.</li>
          </ul>
        </div>
      </Block>

      <Block title="The host workspace">
        <div className="grid gap-2 sm:grid-cols-3">
          {WORKSPACE_TABS.map((t) => (
            <div key={t.t} className="rounded-xl border border-border bg-card p-3">
              <p className="text-xs font-semibold text-foreground">{t.t}</p>
              <p className="text-xs">{t.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          Editing lock: details can be changed while the proposal is Submitted, Changes requested, or still being built.
          Once it moves into review the form locks, with a friendly explanation instead of an error.
        </p>
      </Block>

      <Block title="Statuses a host sees">
        <div className="space-y-2">
          {STATUSES.map((s) => (
            <div key={s.label} className={`flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-xs ${TONE_CLASS[s.tone]}`}>
              <span className="font-bold">{s.label}</span>
              <span className="text-foreground/70">{s.d}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs">
          Colour system: blue = in progress, amber = action needed, green = complete. Red is reserved for Declined only.
        </p>
      </Block>

      <Block title="Access & permissions">
        <HostAccessMatrix />
      </Block>

      <div className="flex flex-wrap gap-2">
        <Link to="/host-a-challenge" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground transition hover:border-primary hover:text-primary">
          Host a Challenge <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link to="/my-challenge-proposals" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground transition hover:border-primary hover:text-primary">
          My challenge proposals <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}