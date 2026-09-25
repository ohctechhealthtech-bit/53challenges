import { Link } from 'react-router-dom';
import {
  Trophy, FileText, Heart, Gavel, Building2, Handshake, Upload, ShieldCheck, Briefcase,
  ArrowRight, BookOpen, Calendar, BarChart3, Bell, Lightbulb, ChevronRight, GraduationCap,
} from 'lucide-react';
import EntryThumb from '@/components/dashboard/EntryThumb';
import ChallengeClassSuggestions from '@/components/dashboard/ChallengeClassSuggestions';
import HomeShortcuts from '@/components/dashboard/HomeShortcuts';
import ClassThumb from '@/components/dashboard/ClassThumb';
import { classDetailsUrl } from '@/lib/siteConfig';

const BLUE = '#2e5bff';
const RED = '#f15249';
const TEAL = '#0a8882';
const AMBER = '#f59e0b';

const ADMIN_LINKS = [
  { to: '/dashboard', label: 'Admin Dashboard', icon: ShieldCheck },
  { to: '/judging', label: 'Judging', icon: Gavel },
  { to: '/judge-portal', label: 'Judge Portal', icon: Gavel },
  { to: '/vote-fraud', label: 'Vote Fraud', icon: ShieldCheck },
  { to: '/audit', label: 'Audit', icon: ShieldCheck },
  { to: '/pathways', label: 'Pathways', icon: Building2 },
  { to: '/marketing', label: 'Marketing', icon: Handshake },
  { to: '/reporting', label: 'Reporting', icon: Briefcase },
  { to: '/coming-soon', label: 'Launch Manager', icon: Upload },
];

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
  } catch {
    return d;
  }
}

/**
 * Home overview tab — a combined snapshot of the user's classes and challenges,
 * with cross-promotion that routes into the Classes tab and external class pages.
 */
export default function DashboardHome({
  entries, votes, judge, sponsor, hostInquiries, enrolled, isAdmin, onGoToClasses,
}) {
  const latest = entries[0] || null;
  const pendingEntries = entries.filter((e) => (e.status || '').toLowerCase() === 'pending');
  const approvedEntries = entries.filter((e) => (e.status || '').toLowerCase() === 'approved');

  // Next upcoming enrolled class (soonest future, else the last booked).
  const upcoming = [...enrolled]
    .filter((c) => c.class_date)
    .sort((a, b) => new Date(a.class_date) - new Date(b.class_date));
  const nextEnrolled =
    upcoming.find((c) => new Date(`${c.class_date}T${c.class_time || '00:00'}`) >= new Date()) ||
    upcoming[upcoming.length - 1] ||
    null;

  const completedClasses = enrolled.filter((c) => (c.status || '').toLowerCase() === 'completed').length;
  const progress = nextEnrolled?.progress ?? nextEnrolled?.completion_percent;

  return (
    <div className="space-y-6">
      {/* ── Top row: Active challenge (priority) + Continue learning ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Your active challenge */}
        <FocusCard icon={Trophy} color={RED} title="Your active challenge">
          {latest ? (
            <div className="mt-4">
              <div className="flex gap-4">
                <EntryThumb entry={latest} />
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 font-bold text-slate-900">{latest.challenge_title || 'Your challenge'}</h3>
                  <span className="mt-1 inline-block rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                    {approvedEntries.length ? 'Entry is live' : 'Awaiting approval'}
                  </span>
                </div>
              </div>
              <Link
                to={latest.challenge_id ? `/challenges/${latest.challenge_id}` : '/challenges'}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white"
                style={{ backgroundColor: RED }}
              >
                View challenge <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <EmptyState
              text="No active challenge right now."
              cta="Find a challenge"
              to="/challenges"
              color={RED}
            />
          )}
        </FocusCard>

        {/* Continue learning → enrolled class */}
        <FocusCard icon={BookOpen} color={BLUE} title="Continue learning">
          {nextEnrolled ? (
            <div className="mt-4">
              <div className="flex gap-4">
                <ClassThumb src={nextEnrolled.image} alt={nextEnrolled.title} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your class</p>
                  <h3 className="mt-0.5 line-clamp-2 font-bold text-slate-900">{nextEnrolled.title}</h3>
                  {typeof progress === 'number' ? (
                    <>
                      <p className="mt-1 text-xs text-slate-500">{progress}% complete</p>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: BLUE }} />
                      </div>
                    </>
                  ) : (
                    <span className="mt-1 inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-blue-700">
                      {nextEnrolled.status || 'in progress'}
                    </span>
                  )}
                </div>
              </div>
              <a
                href={classDetailsUrl(nextEnrolled.class_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white"
                style={{ backgroundColor: BLUE }}
              >
                Continue class <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          ) : (
            <EmptyState
              text="You haven't booked a class yet."
              cta="Browse classes"
              onClick={onGoToClasses}
              color={BLUE}
            />
          )}
        </FocusCard>

      </div>

      {/* ── Middle row: Upcoming + Progress snapshot ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SimpleCard icon={Calendar} color={BLUE} title="Upcoming">
          {nextEnrolled ? (
            <button onClick={onGoToClasses} className="flex w-full items-center justify-between text-left">
              <div>
                <p className="font-semibold text-slate-900">{nextEnrolled.title}</p>
                <p className="text-xs text-slate-500">
                  {fmtDate(nextEnrolled.class_date)}
                  {nextEnrolled.class_time ? ` • ${nextEnrolled.class_time}` : ''}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
            </button>
          ) : hostInquiries[0] ? (
            <Link to="/host-a-challenge" className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{hostInquiries[0].challenge_title || hostInquiries[0].company_name}</p>
                <p className="text-xs capitalize text-slate-500">{hostInquiries[0].pipeline_status?.replace(/_/g, ' ') || hostInquiries[0].status || 'in review'}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </Link>
          ) : (
            <button onClick={onGoToClasses} className="flex w-full items-center justify-between text-left">
              <div>
                <p className="font-semibold text-slate-900">Browse classes</p>
                <p className="text-xs text-slate-500">See what's running right now</p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </button>
          )}
        </SimpleCard>

        <SimpleCard icon={BarChart3} color={TEAL} title="Progress snapshot">
          <div className="flex items-center gap-6">
            <Metric icon={GraduationCap} value={completedClasses} label="classes completed" color={TEAL} />
            <Metric icon={Trophy} value={entries.length} label="active challenge" color={RED} />
            <Metric icon={Heart} value={votes} label="votes cast" color={BLUE} />
          </div>
        </SimpleCard>
      </div>

      {/* ── Needs your attention ── */}
      <FocusCard icon={Bell} color={AMBER} title="Needs your attention">
        <div className="mt-2 divide-y divide-slate-100">
          {approvedEntries.length > 0 && (
            <AttentionRow
              icon={FileText}
              text={`Your entry '${approvedEntries[0].title}' is live and open for votes.`}
              to="/my-entries"
            />
          )}
          {pendingEntries.length > 0 && (
            <AttentionRow
              icon={FileText}
              text={`Your entry '${pendingEntries[0].title}' is awaiting approval.`}
              to="/my-entries"
            />
          )}
          {!judge && (
            <AttentionRow
              icon={Gavel}
              text="You've been invited to judge — apply to help decide national champions."
              to="/become-a-judge"
            />
          )}
          {!sponsor && (
            <AttentionRow
              icon={Handshake}
              text="Set up a sponsor profile to back a challenge with your brand."
              to="/run-a-challenge"
            />
          )}
          {approvedEntries.length === 0 && pendingEntries.length === 0 && judge && sponsor && (
            <div className="py-3 text-sm text-slate-500">You're all caught up. 🎉</div>
          )}
        </div>
      </FocusCard>

      {/* ── Recommended next step ── */}
      <FocusCard icon={Lightbulb} color={TEAL} title="Recommended next step">
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            Use your skills in a creative challenge, or keep learning with a new class.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/challenges"
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: TEAL }}
            >
              Explore challenge <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={onGoToClasses}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <BookOpen className="h-4 w-4" /> Check more classes
            </button>
          </div>
        </div>
      </FocusCard>

      {/* Judge + Winnings shortcuts */}
      <HomeShortcuts judge={judge} />

      {/* Cross-promote classes relevant to the user's challenge entries */}
      <ChallengeClassSuggestions entries={entries} />

      {/* Admin */}
      {isAdmin && (
        <FocusCard icon={ShieldCheck} color={BLUE} title="Administration">
          <p className="mt-1 text-sm text-slate-500">Platform management tools — admins only.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ADMIN_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <span className="inline-flex items-center gap-2"><l.icon className="h-4 w-4 text-slate-400" /> {l.label}</span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </div>
        </FocusCard>
      )}
    </div>
  );
}

function FocusCard({ icon: Icon, color, title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ backgroundColor: `${color}1a`, color }}>
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function SimpleCard({ icon: Icon, color, title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-slate-900">
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ backgroundColor: `${color}1a`, color }}>
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Metric({ icon: Icon, value, label, color }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4" style={{ color }} />
      <div>
        <p className="text-lg font-extrabold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function AttentionRow({ icon: Icon, text, to }) {
  return (
    <Link to={to} className="flex items-center justify-between py-3 transition hover:bg-slate-50">
      <span className="flex items-center gap-3 text-sm text-slate-700">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
          <Icon className="h-4 w-4" />
        </span>
        {text}
      </span>
      <ChevronRight className="h-5 w-5 text-slate-400" />
    </Link>
  );
}

function EmptyState({ text, cta, to, onClick, color }) {
  return (
    <div className="mt-4">
      <p className="text-sm text-slate-500">{text}</p>
      {to ? (
        <Link
          to={to}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {cta} <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <button
          onClick={onClick}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {cta} <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}