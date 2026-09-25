import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Heart, Users, Upload, Play, Palette, Camera, PenTool, Code2, Mic,
  Shield, Award, Building2, BarChart3, FileText, LogIn, Mail, KeyRound,
  CheckCircle2, Clock, Vote, MapPin, Sparkles, GraduationCap, Store, Briefcase,
  ChevronDown, ChevronRight, BookOpen, ArrowRight, Gift, Users2, Target, Printer,
  Gavel, Network, Megaphone, ScrollText, ShieldAlert, LayoutDashboard, Rocket,
  Handshake, Compass, Map, Milestone, Flag,
} from 'lucide-react';
import HostMarketplaceGuide from '@/components/manual/HostMarketplaceGuide';

const SIX_CATEGORIES = [
  { icon: Map, name: 'Outdoor & Adventure', desc: 'Outdoors, sport, fishing & field crafts' },
  { icon: Palette, name: 'Art, Craft & Making', desc: 'Painting, drawing, craft & making' },
  { icon: Mic, name: 'Music, Dance & Performance', desc: 'Music, dance & stage performance' },
  { icon: Camera, name: 'Photography, Film & Digital', desc: 'Photography, film, video & digital art' },
  { icon: PenTool, name: 'Writing, Ideas & Innovation', desc: 'Writing, poetry, ideas & innovation' },
  { icon: Sparkles, name: 'Food, Farming & Community', desc: 'Food, farming, cooking & community' },
];

const NAV_PUBLIC = [
  { to: '/challenges', label: 'Explore', icon: Compass, desc: 'Browse every active challenge, filter by category and phase.' },
  { to: '/challenges?phase=vote', label: 'Vote', icon: Vote, desc: 'Jump straight to challenges currently open for voting.' },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy, desc: 'Verified state and creator rankings from audited results.' },
  { to: '/hall-of-fame', label: 'Hall of Fame', icon: Award, desc: 'Independently audited champions and series winners.' },
];

const NAV_GET_INVOLVED = [
  { to: '/become-a-judge', label: 'Become a Judge', icon: Gavel, desc: 'Apply to join a judging panel.' },
  { to: '/challenges', label: 'Enter a Challenge', icon: Sparkles, desc: 'Find and submit to a live challenge.' },
  { to: '/about', label: 'About', icon: BookOpen, desc: 'The 53 Challenges mission and story.' },
  { to: '/my-dashboard', label: 'My Dashboard', icon: LayoutDashboard, desc: 'Your personal hub (sign-in required).' },
];

const NAV_ORGS = [
  { to: '/host-a-challenge', label: 'Host a Challenge', icon: Building2, desc: 'Submit a proposal to host a sponsored challenge.' },
  { to: '/run-a-challenge', label: 'Run a Competition', icon: Rocket, desc: 'Inquire about running a branded competition.' },
  { to: '/sponsor-portal', label: 'Sponsor', icon: Handshake, desc: 'Sponsor portal for active sponsors.' },
];

const ADMIN_TOOLS = [
  { to: '/dashboard', label: 'Admin Dashboard', icon: LayoutDashboard, desc: 'Platform overview, partnerships, finalists, judging, audit, marketing.' },
  { to: '/judging', label: 'Judging', icon: Gavel, desc: 'Build panels, define criteria, run the scoring lifecycle.' },
  { to: '/judge-portal', label: 'Judge Portal', icon: Gavel, desc: 'Assigned judges score their entries blind.' },
  { to: '/vote-fraud', label: 'Vote Fraud', icon: ShieldAlert, desc: 'Detect suspicious voting patterns and exclude bad votes.' },
  { to: '/audit', label: 'Audit', icon: ScrollText, desc: 'Audit competitions, lock results, manage prize payouts.' },
  { to: '/pathways', label: 'Pathways', icon: Network, desc: 'Configure competition pathways and series standings.' },
  { to: '/marketing', label: 'Marketing', icon: Megaphone, desc: 'Audience members, campaigns, organisations, pipeline.' },
  { to: '/reporting', label: 'Reporting', icon: BarChart3, desc: 'Centralised metrics across competitions, audience, judges.' },
  { to: '/coming-soon', label: 'Launch Manager', icon: Compass, desc: 'Live and coming-soon launch competitions by category.' },
];

const SITE_MAP = [
  { to: '/', label: 'Home', desc: 'Featured challenge, utility bar, live grid, explore, rankings, organisations.' },
  { to: '/challenges', label: 'Challenges', desc: 'All active challenges with category + phase filters.' },
  { to: '/challenges/:id', label: 'Challenge Finalists', desc: 'Entries, voting, scoring methodology, rankings.' },
  { to: '/challenges/:id/submit', label: 'Submit Entry', desc: 'Multi-step entry flow with eligibility gating.' },
  { to: '/leaderboard', label: 'Leaderboard', desc: 'Audited state and creator rankings.' },
  { to: '/hall-of-fame', label: 'Hall of Fame', desc: 'Verified champions and series winners.' },
  { to: '/ecosystem', label: 'Ecosystem', desc: 'The 53 product family.' },
  { to: '/about', label: 'About', desc: 'Mission and overview.' },
  { to: '/my-dashboard', label: 'My Dashboard', desc: 'Role-aware personal hub.' },
  { to: '/profile', label: 'My Profile', desc: 'Your account details.' },
  { to: '/my-entries', label: 'My Entries', desc: 'Your submitted work.' },
  { to: '/my-votes', label: 'My Votes', desc: 'Entries you have voted on.' },
  { to: '/become-a-judge', label: 'Become a Judge', desc: 'Judge application.' },
  { to: '/host-a-challenge', label: 'Host a Challenge', desc: 'Sponsored challenge proposal form.' },
  { to: '/run-a-challenge', label: 'Run a Competition', desc: 'Branded competition inquiry form.' },
  { to: '/sponsor-portal', label: 'Sponsor Portal', desc: 'Sponsor view of competitions and results.' },
  { to: '/ty', label: 'TY Planner', desc: 'AI-assisted challenge planning.' },
  { to: '/dashboard', label: 'Admin Dashboard', desc: 'Admin-only platform hub.' },
  { to: '/judging', label: 'Judging Admin', desc: 'Panel and scoring lifecycle management.' },
  { to: '/judge-portal', label: 'Judge Portal', desc: 'Judge scoring workspace.' },
  { to: '/vote-fraud', label: 'Vote Fraud Dashboard', desc: 'Vote integrity monitoring.' },
  { to: '/audit', label: 'Audit Workspace', desc: 'Competition audit and prize payouts.' },
  { to: '/pathways', label: 'Pathways', desc: 'Competition pathways and series standings.' },
  { to: '/marketing', label: 'Marketing', desc: 'Audience, campaigns, organisations, pipeline.' },
  { to: '/reporting', label: 'Reporting', desc: 'Centralised metrics.' },
  { to: '/coming-soon', label: 'Launch Manager', desc: 'Launch competitions by status.' },
  { to: '/manual', label: 'Portal Manual', desc: 'This page.' },
];

function MenuGrid({ items }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((m) => (
        <Link key={m.to + m.label} to={m.to} className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3 transition hover:border-primary hover:text-primary">
          <m.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="font-semibold text-foreground">{m.label}</p>
            <p className="text-xs text-muted-foreground">{m.desc}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

const SECTIONS = [
  {
    id: 'overview',
    title: 'Overview',
    icon: BookOpen,
    body: (
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p><span className="font-semibold text-foreground">53 Challenges</span> is Australia's home of challenges — a personal-growth and creative-discovery platform where creators submit their work to themed challenges, the community votes, judges score, and verified winners earn real cash prizes. It is part of the <span className="font-semibold text-foreground">53 Ecosystem</span>, a family of products sharing one account.</p>
        <p>The mission: guide people through 53 transformative challenges, one week at a time, to build new habits and achieve their goals while getting discovered by brands, studios, and recruiters.</p>
        <p className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-foreground">Trust is the foundation: public rankings, the Hall of Fame, and the leaderboard are built only from <span className="font-semibold">independently audited</span> competition results — never raw vote counts. Unverified or provisional activity is clearly labelled as such.</p>
      </div>
    ),
  },
  {
    id: 'navigation',
    title: 'Navigation & Menus',
    icon: Compass,
    body: (
      <div className="space-y-5 text-sm text-muted-foreground">
        <div>
          <p className="font-semibold text-foreground">Public nav (top bar)</p>
          <p className="mt-1">Always visible to everyone:</p>
          <div className="mt-2"><MenuGrid items={NAV_PUBLIC} /></div>
        </div>
        <div>
          <p className="font-semibold text-foreground">Get Involved (dropdown)</p>
          <div className="mt-2"><MenuGrid items={NAV_GET_INVOLVED} /></div>
        </div>
        <div>
          <p className="font-semibold text-foreground">For Organisations (dropdown)</p>
          <div className="mt-2"><MenuGrid items={NAV_ORGS} /></div>
        </div>
        <div>
          <p className="font-semibold text-foreground">Account menu (top-right avatar)</p>
          <p className="mt-1">When signed in, your avatar opens My Dashboard, My Profile, My Entries, My Votes, and the Portal Manual. Admins also see the Admin tools block below.</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Admin tools (admins only)</p>
          <p className="mt-1">Surfaced in the account menu and the mobile menu for admin users:</p>
          <div className="mt-2"><MenuGrid items={ADMIN_TOOLS} /></div>
        </div>
        <p className="rounded-lg border border-border bg-card p-3">The primary red CTA in the nav is <span className="font-semibold text-foreground">Enter a Challenge</span>, linking to the Challenges page.</p>
      </div>
    ),
  },
  {
    id: 'homepage',
    title: 'Homepage Layout',
    icon: LayoutDashboard,
    body: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>The homepage follows the new standard layout, top to bottom:</p>
        <ol className="space-y-2">
          {[
            { t: 'Featured Hero', d: 'Gold-outline "Featured National Challenge" label, challenge title + tagline, metadata (entries-close date, evidence type, prize pool), and three actions: Enter Challenge, Watch & Vote, Follow Challenge.' },
            { t: 'Cream Utility Bar', d: '"How do you want to take part?" with three white cards: Compete, Support, Organisations.' },
            { t: 'Live Now Grid', d: 'Tabs for Open for Entries / Voting Now / Coming Soon, four cards per row, colour-coded badges (teal, purple, tan).' },
            { t: 'Explore by Activity', d: 'Tiles for the six canonical categories with live per-category counts.' },
            { t: 'Rankings Ribbon', d: '"Represent your state. Compete for Australia." plus "National Champions Earn the Gold.", state-code chips, and a numbered 1–8 list from audited standings.' },
            { t: 'Organisations (B2B)', d: 'Sponsor / Host / Managed cards plus Become a Judge, Jobs & Opportunities, Volunteer or Partner links.' },
            { t: 'Footer', d: "Australia's home of challenges. How it works / Rules / Safety / Privacy / Terms / Contact, socials, 🇦🇺 Proudly Australian." },
          ].map((s, i) => (
            <li key={s.t} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/15 text-xs font-bold text-primary">{i + 1}</span>
              <div><p className="font-semibold text-foreground">{s.t}</p><p className="text-xs">{s.d}</p></div>
            </li>
          ))}
        </ol>
        <p>Everything below the hero is lazy-loaded for performance, and all scroll-reveal animation respects the system reduced-motion preference.</p>
      </div>
    ),
  },
  {
    id: 'ecosystem',
    title: 'The 53 Ecosystem',
    icon: Sparkles,
    body: (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">One account works across the entire 53 family:</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: GraduationCap, name: '53 Classes', verb: 'Learn', desc: 'Expert-led courses to master your craft.', live: true },
            { icon: Trophy, name: '53 Challenges', verb: 'Compete', desc: 'Prove your skills and get discovered.', live: true, current: true },
            { icon: Palette, name: '53 Cox Road Gallery', verb: 'Showcase', desc: 'A curated home for the best work.', live: true },
            { icon: Code2, name: '53 Studios', verb: 'Create', desc: 'Tools and spaces to make your best work.', live: false },
            { icon: Store, name: '53 Marketplace', verb: 'Sell', desc: 'Turn your creativity into income.', live: false },
            { icon: Briefcase, name: '53 Jobs', verb: 'Work', desc: 'Get hired for real creative briefs.', live: false },
          ].map((e) => (
            <div key={e.name} className={`rounded-xl border p-4 ${e.current ? 'border-primary bg-secondary' : 'border-border bg-card'}`}>
              <div className="flex items-center gap-2">
                <e.icon className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">{e.name}</span>
                {e.current && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">Here</span>}
                {!e.live && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">Soon</span>}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{e.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'categories',
    title: 'Challenge Categories',
    icon: Palette,
    body: (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">Every challenge belongs to one of six canonical parent categories — the single source of truth across the homepage, filters, and category landing:</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {SIX_CATEGORIES.map((c) => (
            <div key={c.name} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
              <c.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div><p className="font-semibold text-foreground">{c.name}</p><p className="text-xs text-muted-foreground">{c.desc}</p></div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'divisions',
    title: 'Divisions & States',
    icon: Users,
    body: (
      <div className="space-y-4 text-sm">
        <div>
          <p className="font-semibold text-foreground">Divisions</p>
          <p className="mt-1 text-muted-foreground">Entries are grouped by age-based divisions:</p>
          <ul className="mt-2 space-y-1.5">
            <li className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-md bg-primary/15 text-xs font-bold text-primary">7+</span> Children — Ages 7–12</li>
            <li className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-md bg-primary/15 text-xs font-bold text-primary">13+</span> Teens — Ages 13–19</li>
            <li className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-md bg-primary/15 text-xs font-bold text-primary">20+</span> Adults — 20 and over</li>
            <li className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-md bg-primary/15 text-xs font-bold text-primary">NDI</span> NDI division</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-foreground">Geographic States</p>
          <p className="mt-1 text-muted-foreground">Challenges and entries are tagged by Australian state/territory, which feeds the state rankings:</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'NT', 'ACT'].map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary"><MapPin className="h-3 w-3" /> {s}</span>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'phases',
    title: 'Challenge Lifecycle',
    icon: Clock,
    body: (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">Each challenge moves through four phases:</p>
        <div className="space-y-2">
          {[
            { step: '01', icon: Clock, title: 'Upcoming', desc: 'Published but not yet open for submissions.' },
            { step: '02', icon: Upload, title: 'Submit', desc: 'Creators upload their work during the submission window.' },
            { step: '03', icon: Vote, title: 'Vote', desc: 'The community votes. Vote counts are hidden until voting ends.' },
            { step: '04', icon: Trophy, title: 'Closed', desc: 'Voting ended; results audited; winners announced and prizes awarded.' },
          ].map((p) => (
            <div key={p.step} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
              <span className="font-heading text-xs font-bold text-muted-foreground/50">{p.step}</span>
              <p.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div><p className="font-semibold text-foreground">{p.title}</p><p className="text-xs text-muted-foreground">{p.desc}</p></div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'entries',
    title: 'Submitting an Entry',
    icon: FileText,
    body: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p><span className="font-semibold text-foreground">Step 1 — Choose a challenge:</span> Browse active challenges on the Challenges page and click "Submit Entry".</p>
        <p><span className="font-semibold text-foreground">Step 2 — Fill in your details:</span> Enter your name, state, division, and work details.</p>
        <p><span className="font-semibold text-foreground">Step 3 — Submit your work:</span> Paste text directly or link to your work (image/video).</p>
        <p><span className="font-semibold text-foreground">Step 4 — Guardian consent (minors):</span> Required if you are under 18.</p>
        <p><span className="font-semibold text-foreground">Step 5 — Review & confirm:</span> A final review screen lets you confirm before submission.</p>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">Entries go through an approval queue (pending → approved/rejected) before appearing publicly. Private or invitational pathways may require an access code or organisation match.</p>
      </div>
    ),
  },
  {
    id: 'voting',
    title: 'Voting & Prizes',
    icon: Heart,
    body: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p><span className="font-semibold text-foreground">One vote per entry per user</span> — enforced on the server to prevent duplicate voting.</p>
        <p><span className="font-semibold text-foreground">Vote counts are hidden</span> until the challenge's voting deadline passes, keeping voting fair and preventing early bias.</p>
        <p><span className="font-semibold text-foreground">Cash prizes</span> are awarded to winning entries after voting closes and results are audited. The prize pool varies per challenge.</p>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-300">
          <p className="flex items-center gap-2 font-semibold"><Gift className="h-4 w-4" /> Every winning challenge has a real cash prize, recorded in the Prize Ledger.</p>
        </div>
        <p>Unauthenticated voters are redirected to login — your return path is preserved so you can vote right after signing in.</p>
      </div>
    ),
  },
  {
    id: 'scoring',
    title: 'Judging & Combined Scoring',
    icon: Gavel,
    body: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>Competitions can use a combined weighted scoring model — <span className="font-semibold text-foreground">judge scores</span> plus <span className="font-semibold text-foreground">public votes</span> — configured per competition via a Scoring Model.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { icon: Gavel, t: 'Judging Panels', d: 'A panel with a head judge, criteria, weights, and a scale max. Phases: draft → calibration → scoring → locked → complete.' },
            { icon: Shield, t: 'Blind Judging', d: 'Judges can score entries blind (identities hidden) for fairness.' },
            { icon: Users, t: 'Calibration', d: 'Judges calibrate against reference entries before live scoring.' },
            { icon: Trophy, t: 'Combined Results', d: 'Judge and public weights produce a final combined ranking per competition.' },
          ].map((x) => (
            <div key={x.t} className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
              <x.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div><p className="font-semibold text-foreground">{x.t}</p><p className="text-xs">{x.d}</p></div>
            </div>
          ))}
        </div>
        <p>Manage panels in <Link to="/judging" className="text-primary hover:underline">Judging Admin</Link>; assigned judges score in the <Link to="/judge-portal" className="text-primary hover:underline">Judge Portal</Link>.</p>
      </div>
    ),
  },
  {
    id: 'audit',
    title: 'Audit & Vote Integrity',
    icon: ScrollText,
    body: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>Every competition can be held for audit before results go public. The <Link to="/audit" className="text-primary hover:underline">Audit Workspace</Link> handles the full close-out:</p>
        <ul className="space-y-1.5">
          {[
            'Vote audit logs and fraud detection flag suspicious votes for exclusion.',
            'Judging audit logs track every score and panel change.',
            'Results are locked once audited; a finished flag controls public visibility of rankings and vote counts.',
            'Prize Ledger records every payout; prize payouts are actioned from the workspace.',
          ].map((t) => (
            <li key={t} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {t}</li>
          ))}
        </ul>
        <p>Suspicious voting patterns are surfaced in the <Link to="/vote-fraud" className="text-primary hover:underline">Vote Fraud Dashboard</Link>, where bad votes can be excluded with a reason and an audit trail.</p>
      </div>
    ),
  },
  {
    id: 'pathways',
    title: 'Pathways & Series Rankings',
    icon: Network,
    body: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>Competitions are composed from modular catalog entities (Category, Subcategory, Mechanic, Pathway, Participation Mode, Evidence Requirement, Scoring Model, Audience Type) — nothing is hard-coded.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { icon: Milestone, t: 'Pathway types', d: 'National/state ranking, state→national, local→state→national, series championship, private organisation, invitational.' },
            { icon: Trophy, t: 'Series Standings', d: 'Creators accumulate points across pathway events; best placings and totals roll up into rankings.' },
            { icon: Award, t: 'Promotions', d: 'Top entries from qualifier challenges promote into anchor/national finals.' },
            { icon: Map, t: 'State roll-up', d: 'Standings aggregate by state to power the homepage and leaderboard ribbons.' },
          ].map((x) => (
            <div key={x.t} className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
              <x.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div><p className="font-semibold text-foreground">{x.t}</p><p className="text-xs">{x.d}</p></div>
            </div>
          ))}
        </div>
        <p>Configure pathways in <Link to="/pathways" className="text-primary hover:underline">Pathways</Link>.</p>
      </div>
    ),
  },
  {
    id: 'marketing',
    title: 'Marketing & Audience',
    icon: Megaphone,
    body: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>The <Link to="/marketing" className="text-primary hover:underline">Marketing</Link> module manages audience and partnerships:</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { t: 'Audience Members', d: 'Creators, voters, sponsors, parents, educators — with interests, state, and engagement counts.' },
            { t: 'Email Campaigns', d: 'Targeted by audience type, state, category, participation; sent to registered app users.' },
            { t: 'Organisations', d: 'Schools, clubs, workplaces, councils with signup codes and leaderboards.' },
            { t: 'Sponsor Profiles', d: 'Sponsors linked to their competitions.' },
            { t: 'Partner Pipeline', d: 'Inquiries from new → in discussion → confirmed → live.' },
            { t: 'Lifecycle Emails', d: 'Welcome and entry-confirmed triggers fire automatically.' },
          ].map((x) => (
            <div key={x.t} className="rounded-lg border border-border bg-card p-3">
              <p className="font-semibold text-foreground">{x.t}</p><p className="text-xs">{x.d}</p>
            </div>
          ))}
        </div>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">Email delivery reaches registered app users only; unregistered contacts require a secondary email provider.</p>
      </div>
    ),
  },
  {
    id: 'reporting',
    title: 'Reporting Dashboard',
    icon: BarChart3,
    body: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>The <Link to="/reporting" className="text-primary hover:underline">Reporting</Link> page is a centralised, read-only view of platform health, aggregating metrics across competitions, audience, judges, campaigns, the partner pipeline, and moderation — sourced from a dedicated reporting backend function.</p>
        <p>Use it for a single source of truth on participation, engagement, and pipeline without touching operational tools.</p>
      </div>
    ),
  },
  {
    id: 'sponsor',
    title: 'Sponsor Portal',
    icon: Handshake,
    body: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>The <Link to="/sponsor-portal" className="text-primary hover:underline">Sponsor Portal</Link> is a read-only dashboard for active sponsors:</p>
        <ul className="space-y-1.5">
          {[
            'Lists the competitions linked to your sponsor profile.',
            'Shows entry counts and vote totals per competition.',
            'Displays competition leaderboards once audited results are available.',
          ].map((t) => (
            <li key={t} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {t}</li>
          ))}
        </ul>
        <p>Access requires a Sponsor Profile linked to your account.</p>
      </div>
    ),
  },
  {
    id: 'auth',
    title: 'Account & Authentication',
    icon: Shield,
    body: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p><span className="font-semibold text-foreground">Email & Password:</span> Register with your email, receive an OTP verification code, verify it, and you're in.</p>
        <p><span className="font-semibold text-foreground">Google Sign-In:</span> One-click login with your Google account.</p>
        <p><span className="font-semibold text-foreground">Password recovery:</span> Use the "Forgot password" link to receive a reset email.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5"><LogIn className="h-4 w-4 text-primary" /><span className="text-xs">Register → OTP → Verify → Login</span></div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5"><KeyRound className="h-4 w-4 text-primary" /><span className="text-xs">Forgot → Email → Reset</span></div>
        </div>
        <p>Users join by invite; admins can invite users as "user" or "admin" roles.</p>
      </div>
    ),
  },
  {
    id: 'mydashboard',
    title: 'My Dashboard',
    icon: LayoutDashboard,
    body: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>The <Link to="/my-dashboard" className="text-primary hover:underline">My Dashboard</Link> page is a role-aware personal hub that aggregates your participant data and routes you to the right portal tool based on your permissions:</p>
        <ul className="space-y-1.5">
          {[
            'Creators: entries, votes, and challenge progress.',
            'Judges: link to the Judge Portal for assigned scoring.',
            'Sponsors: link to the Sponsor Portal.',
            'Admins: links to all operational tools.',
          ].map((t) => (
            <li key={t} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {t}</li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'account',
    title: 'Your Account',
    icon: Users2,
    body: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>From your profile dropdown (top right), you can access:</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { icon: LayoutDashboard, label: 'My Dashboard', desc: 'Role-aware personal hub' },
            { icon: Users2, label: 'My Profile', desc: 'View and edit your profile details' },
            { icon: FileText, label: 'My Entries', desc: 'Track all your submitted work' },
            { icon: Heart, label: 'My Votes', desc: 'See entries you have voted on' },
            { icon: BookOpen, label: 'Portal Manual', desc: 'This guide' },
          ].map((m) => (
            <div key={m.label} className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
              <m.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div><p className="font-semibold text-foreground">{m.label}</p><p className="text-xs">{m.desc}</p></div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'hostmarketplace',
    title: 'Host a Challenge — Full Workflow & Access',
    icon: Building2,
    body: <HostMarketplaceGuide />,
  },
  {
    id: 'partners',
    title: 'Host / Run a Challenge',
    icon: Building2,
    body: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>Organisations can host their own sponsored challenges. The <Link to="/host-a-challenge" className="text-primary hover:underline">Host a Challenge</Link> and <Link to="/run-a-challenge" className="text-primary hover:underline">Run a Competition</Link> funnels capture:</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {['Company details & website', 'Industry', 'Challenge type & goal', 'Target audience & size', 'Geographic scope', 'Launch timing & budget', 'Prize format', 'How they heard about us'].map((f) => (
            <div key={f} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {f}
            </div>
          ))}
        </div>
        <p>Submissions become Partner Inquiries reviewed in the admin Dashboard; the TY Planner can turn a proposal into a draft challenge plan.</p>
      </div>
    ),
  },
  {
    id: 'pages',
    title: 'Site Map',
    icon: Target,
    body: (
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        {SITE_MAP.map((p) => (
          <Link key={p.to} to={p.to} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 transition hover:border-primary hover:text-primary">
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />
            <div>
              <span className="font-semibold text-foreground">{p.label}</span>
              <span className="block text-xs text-muted-foreground">{p.desc}</span>
            </div>
          </Link>
        ))}
      </div>
    ),
  },
  {
    id: 'design',
    title: 'Design & Principles',
    icon: Award,
    body: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p><span className="font-semibold text-foreground">Dark theme</span> with deep blue-black backgrounds, rounded cards, and a signature red (<span className="font-semibold text-foreground">#ff4d4d</span>) brand accent with gold highlights.</p>
        <p><span className="font-semibold text-foreground">Cream utility bar</span> for the "How do you want to take part?" section, with dark text on cream.</p>
        <p><span className="font-semibold text-foreground">Token-based design system</span> — colors and fonts defined in CSS variables, mapped to Tailwind classes.</p>
        <p><span className="font-semibold text-foreground">Fully responsive</span> — works beautifully on mobile, tablet, and desktop.</p>
        <p><span className="font-semibold text-foreground">Motion</span> — scroll-reveal and hover effects throughout, all respecting the system reduced-motion preference.</p>
        <p><span className="font-semibold text-foreground">Real-time updates</span> — new entries and vote changes appear live via subscriptions.</p>
        <p><span className="font-semibold text-foreground">Auth-gated actions</span> — submitting and voting require a logged-in account.</p>
        <p><span className="font-semibold text-foreground">Trust by default</span> — public metrics show only audited data; unverified activity is clearly labelled.</p>
      </div>
    ),
  },
];

export default function PortalManual() {
  const [openId, setOpenId] = useState('overview');

  const handlePrint = () => {
    setOpenId('all');
    setTimeout(() => window.print(), 100);
  };

  return (
    <div className="container-tight py-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
            <BookOpen className="h-4 w-4" /> Portal Manual
          </div>
          <h1 className="mt-2 font-heading text-3xl font-extrabold sm:text-4xl">
            Everything about <span className="grad-text">53 Challenges</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            A complete guide to every menu, page, and system — from the homepage and challenges to judging, audit, pathways, marketing, and reporting.
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="print:hidden inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
        >
          <Printer className="h-4 w-4" /> Print / Save PDF
        </button>
      </div>

      {/* Quick stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Palette, label: 'Categories', value: '6' },
          { icon: Users, label: 'Divisions', value: '4' },
          { icon: MapPin, label: 'States', value: '8' },
          { icon: Flag, label: 'Pages', value: `${SITE_MAP.length}` },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary"><s.icon className="h-5 w-5" /></span>
            <div>
              <p className="font-heading text-xl font-extrabold leading-none">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Accordion sections */}
      <div className="mt-10 space-y-3">
        {SECTIONS.map((section) => {
          const isOpen = openId === 'all' || openId === section.id;
          return (
            <div key={section.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <button
                onClick={() => setOpenId(isOpen ? '' : section.id)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50"
                aria-expanded={isOpen}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  <section.icon className="h-4.5 w-4.5" />
                </span>
                <span className="flex-1 font-heading text-base font-bold text-foreground">{section.title}</span>
                {isOpen ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="border-t border-border px-5 py-5">
                  {section.body}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="print:hidden mt-12 rounded-[2rem] border border-border bg-card p-8 text-center sm:p-12">
        <h2 className="font-heading text-2xl font-extrabold sm:text-3xl">Ready to start?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Join a live challenge, submit your work, and win real cash prizes.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/challenges" className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5 hover:brightness-110">
            <Upload className="h-4 w-4" /> Start a Challenge
          </Link>
          <Link to="/challenges?phase=vote" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:border-white/40 hover:bg-white/10">
            <Play className="h-4 w-4" /> Vote & Win
          </Link>
        </div>
      </div>
    </div>
  );
}