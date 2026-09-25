import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Handshake, Crown, Gavel, ShieldAlert, ScrollText, Network, Megaphone, BarChart3, Image, MessageSquare, Building2, ShieldCheck } from 'lucide-react';
import AttentionTiles from '@/components/dashboard/attention/AttentionTiles';
import WaitingLongest from '@/components/dashboard/attention/WaitingLongest';
import useAdminInbox from '@/components/dashboard/attention/useAdminInbox';
import HostRequestsPanel from '@/components/dashboard/HostRequestsPanel';
import TeamMessages from '@/components/dashboard/team/TeamMessages';
import BrandingSettings from '@/components/dashboard/BrandingSettings';
import ContentApprovalQueue from '@/components/moderation/ContentApprovalQueue';
import { useAuth } from '@/lib/AuthContext';
import PartnerInquiries from '@/components/dashboard/PartnerInquiries';
import FinalistManager from '@/components/dashboard/FinalistManager';
import JudgeManagement from '@/components/dashboard/JudgeManagement';
import ScoringReview from '@/components/dashboard/ScoringReview';

export default function DashboardLegacy() {
  const { user, isAuthenticated, navigateToLogin } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tab = params.get('tab') || 'overview';
  const sub = params.get('sub') || '';
  const setTab = (t) => navigate(t === 'overview' ? '/DashboardLegacy' : `/DashboardLegacy?tab=${t}`);
  const { inbox, loading: inboxLoading, error: inboxError, reload: reloadInbox } = useAdminInbox();

  const isAdmin = user?.role === 'admin' || user?.role === 'creator' || user?.is_admin === true;
  const countOf = (key) => inbox?.queues?.find((q) => q.key === key)?.count || 0;
  const msgUnread = countOf('messages');
  const hostRequestCount = countOf('proposals') + countOf('ideas') + countOf('enquiries');

  useEffect(() => {
    if (!isAuthenticated) navigateToLogin();
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  if (!isAdmin) {
    return (
      <div className="container-tight py-24 text-center">
        <p className="text-muted-foreground">You don't have access to the dashboard.</p>
      </div>
    );
  }

  const openQueue = (q) => navigate(q.link);

  return (
    <div className="container-tight py-12">
      <h1 className="font-heading text-3xl font-extrabold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Everything waiting on you, in one place.</p>

      {(
        <>
          <div className="mt-6 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
            <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</TabBtn>
            <TabBtn active={tab === 'partnerships'} onClick={() => setTab('partnerships')}>
              <Handshake className="h-4 w-4" /> Partnerships
            </TabBtn>
            <TabBtn active={tab === 'hostrequests'} onClick={() => setTab('hostrequests')}>
              <Building2 className="h-4 w-4" /> Host Requests
              {hostRequestCount > 0 && (
                <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${tab === 'hostrequests' ? 'bg-white/25 text-white' : 'bg-primary text-primary-foreground'}`}>
                  {hostRequestCount}
                </span>
              )}
            </TabBtn>
            <TabBtn active={tab === 'content'} onClick={() => setTab('content')}>
              <ShieldCheck className="h-4 w-4" /> Content
              {countOf('content') > 0 && (
                <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${tab === 'content' ? 'bg-white/25 text-white' : 'bg-primary text-primary-foreground'}`}>
                  {countOf('content')}
                </span>
              )}
            </TabBtn>
            <TabBtn active={tab === 'finalists'} onClick={() => setTab('finalists')}>
              <Crown className="h-4 w-4" /> Finalists
            </TabBtn>
            <TabBtn active={tab === 'judges'} onClick={() => setTab('judges')}>
              <Gavel className="h-4 w-4" /> Judges
            </TabBtn>
            <TabBtn active={tab === 'judging'} onClick={() => setTab('judging')}>
              <Gavel className="h-4 w-4" /> Judging
            </TabBtn>
            <TabBtn active={tab === 'scoring'} onClick={() => setTab('scoring')}>
              <Gavel className="h-4 w-4" /> Scoring
            </TabBtn>
            <TabBtn active={tab === 'fraud'} onClick={() => setTab('fraud')}>
              <ShieldAlert className="h-4 w-4" /> Vote checks
            </TabBtn>
            <TabBtn active={tab === 'audit'} onClick={() => setTab('audit')}>
              <ScrollText className="h-4 w-4" /> Audit
            </TabBtn>
            <TabBtn active={tab === 'pathways'} onClick={() => setTab('pathways')}>
              <Network className="h-4 w-4" /> Pathways
            </TabBtn>
            <TabBtn active={tab === 'marketing'} onClick={() => setTab('marketing')}>
              <Megaphone className="h-4 w-4" /> Marketing
            </TabBtn>
            <TabBtn active={tab === 'reporting'} onClick={() => setTab('reporting')}>
              <BarChart3 className="h-4 w-4" /> Reporting
            </TabBtn>
            <TabBtn active={tab === 'messages'} onClick={() => setTab('messages')}>
              <MessageSquare className="h-4 w-4" /> Messages
              {msgUnread > 0 && (
                <span
                  data-testid="team-unread-badge"
                  className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${tab === 'messages' ? 'bg-white/25 text-white' : 'bg-primary text-primary-foreground'}`}
                >
                  {msgUnread}
                </span>
              )}
            </TabBtn>
            <TabBtn active={tab === 'branding'} onClick={() => setTab('branding')}>
              <Image className="h-4 w-4" /> Branding
            </TabBtn>
          </div>

          {tab === 'overview' && (
            <div className="mt-8">
              <h2 className="font-heading text-xl font-bold">Needs your attention</h2>
              <p className="mt-1 text-sm text-muted-foreground">Busiest first — open a tile to work through it.</p>
              <div className="mt-4">
                <AttentionTiles queues={inbox?.queues || []} loading={inboxLoading} error={inboxError} onRetry={reloadInbox} onOpen={openQueue} />
              </div>
              <WaitingLongest items={inbox?.waiting || []} onOpen={openQueue} />
            </div>
          )}

          {tab === 'partnerships' && (
            <div className="mt-8">
              <h2 className="font-heading text-xl font-bold">Partnership Inquiries</h2>
              <p className="mt-1 text-sm text-muted-foreground">Companies proposing to host a challenge with us.</p>
              <div className="mt-6"><PartnerInquiries /></div>
            </div>
          )}

          {tab === 'hostrequests' && (
            <div className="mt-8">
              <h2 className="font-heading text-xl font-bold">Host & Organisation Requests</h2>
              <p className="mt-1 text-sm text-muted-foreground">Every challenge request that comes in — organisation intake, host proposals and service delivery planning.</p>
              <div className="mt-6"><HostRequestsPanel initialSub={sub} /></div>
            </div>
          )}

          {tab === 'content' && (
            <div className="mt-8">
              <ContentApprovalQueue scope="admin" onCountChange={reloadInbox} />
            </div>
          )}

          {tab === 'finalists' && (
            <div className="mt-8">
              <h2 className="font-heading text-xl font-bold">This Week's Finalists</h2>
              <p className="mt-1 text-sm text-muted-foreground">Mark up to 5 approved entries as finalists to feature them on the homepage.</p>
              <div className="mt-6"><FinalistManager /></div>
            </div>
          )}

          {tab === 'judges' && (
            <div className="mt-8"><JudgeManagement /></div>
          )}

          {tab === 'judging' && (
            <div className="mt-8">
              <h2 className="font-heading text-xl font-bold">Judging Workspace</h2>
              <p className="mt-1 text-sm text-muted-foreground">Assemble panels, define rubrics, run calibration and blind scoring, and audit every action.</p>
              <div className="mt-4">
                <Link to="/judging" className="inline-flex items-center gap-2 rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white">Open judging workspace <Gavel className="h-4 w-4" /></Link>
              </div>
            </div>
          )}

          {tab === 'scoring' && (
            <div className="mt-8">
              <h2 className="font-heading text-xl font-bold">Scoring & Compliance</h2>
              <p className="mt-1 text-sm text-muted-foreground">Track judging progress, review entries flagged for compliance, and score your own allocated entries.</p>
              <div className="mt-6"><ScoringReview /></div>
            </div>
          )}

          {tab === 'fraud' && (
            <div className="mt-8">
              <h2 className="font-heading text-xl font-bold">Vote Fraud Dashboard</h2>
              <p className="mt-1 text-sm text-muted-foreground">Duplicate-account detection, vote-spike anomalies by hour, and disqualified votes with reasons.</p>
              <div className="mt-4">
                <Link to="/vote-fraud" className="inline-flex items-center gap-2 rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white">Open fraud dashboard <ShieldAlert className="h-4 w-4" /></Link>
              </div>
            </div>
          )}

          {tab === 'audit' && (
            <div className="mt-8">
              <h2 className="font-heading text-xl font-bold">Audit & Prize Control</h2>
              <p className="mt-1 text-sm text-muted-foreground">Independent per-competition audit: pre-launch terms check, closed-competition recompute, findings, sign-off and two-person prize release.</p>
              <div className="mt-4">
                <Link to="/audit" className="inline-flex items-center gap-2 rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white">Open audit workspace <ScrollText className="h-4 w-4" /></Link>
              </div>
            </div>
          )}

          {tab === 'pathways' && (
            <div className="mt-8">
              <h2 className="font-heading text-xl font-bold">Pathways, Series & Rankings</h2>
              <p className="mt-1 text-sm text-muted-foreground">National + state rankings, qualifier feeders, series championships, and restricted private/invitational entry.</p>
              <div className="mt-4">
                <Link to="/pathways" className="inline-flex items-center gap-2 rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white">Open pathways builder <Network className="h-4 w-4" /></Link>
              </div>
            </div>
          )}

          {tab === 'marketing' && (
            <div className="mt-8">
              <h2 className="font-heading text-xl font-bold">Marketing & Audience</h2>
              <p className="mt-1 text-sm text-muted-foreground">Audience database, segmented campaigns, group sign-ups, sponsor pipeline and share cards.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link to="/marketing" className="inline-flex items-center gap-2 rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white">Open marketing workspace <Megaphone className="h-4 w-4" /></Link>
                <Link to="/run-a-challenge" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-bold">Run a Challenge page</Link>
              </div>
            </div>
          )}

          {tab === 'reporting' && (
            <div className="mt-8">
              <h2 className="font-heading text-xl font-bold">Reporting Dashboard</h2>
              <p className="mt-1 text-sm text-muted-foreground">Entries, conversion, moderation, judges, EOI counts, campaign sends and the sponsor pipeline — all in one snapshot.</p>
              <div className="mt-4">
                <Link to="/reporting" className="inline-flex items-center gap-2 rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white">Open reporting <BarChart3 className="h-4 w-4" /></Link>
              </div>
            </div>
          )}

          {tab === 'messages' && (
            <div className="mt-8">
              <h2 className="font-heading text-xl font-bold">Participant Messages</h2>
              <p className="mt-1 text-sm text-muted-foreground">Read incoming messages from participants and reply — your reply appears in their message thread.</p>
              <div className="mt-6"><TeamMessages onUnreadChange={reloadInbox} /></div>
            </div>
          )}

          {tab === 'branding' && (
            <div className="mt-8">
              <BrandingSettings />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
    >
      {children}
    </button>
  );
}