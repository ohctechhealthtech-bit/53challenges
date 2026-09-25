import { useEffect, useState } from 'react';
import { Trophy, BookOpen, LayoutDashboard, MessageSquare } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { challengeApi } from '@/lib/challengeApi';
import ClassesTab from '@/components/dashboard/ClassesTab';
import ChallengesTab from '@/components/dashboard/ChallengesTab';
import MessagesTab from '@/components/dashboard/MessagesTab';
import PortalPromo from '@/components/dashboard/PortalPromo';
import DashboardHome from '@/components/dashboard/DashboardHome';
import { teamMessages } from '@/lib/teamMessages';

// One role-aware dashboard. Home = combined overview of challenges + classes;
// Classes = enrolment surface that deep-links to the 53 Classes site.
export default function MyDashboard() {
  const { user, isAuthenticated, navigateToLogin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [votes, setVotes] = useState(0);
  const [judge, setJudge] = useState(null);
  const [sponsor, setSponsor] = useState(null);
  const [hostInquiries, setHostInquiries] = useState([]);
  const [enrolled, setEnrolled] = useState([]);
  const [running, setRunning] = useState([]);
  const [tab, setTab] = useState('home');
  const [unread, setUnread] = useState(0);

  const refreshUnread = () => {
    teamMessages.myUnread().then((d) => setUnread(d?.unread || 0)).catch(() => null);
  };
  useEffect(() => { if (isAuthenticated) refreshUnread(); }, [isAuthenticated, user?.email]);

  const isAdmin = user?.role === 'admin' || user?.role === 'creator' || user?.is_admin === true;
  const firstName = user?.full_name ? user.full_name.split(' ')[0] : (user?.email ? user.email.split('@')[0] : '');

  useEffect(() => {
    if (!isAuthenticated) { navigateToLogin(); return; }
    (async () => {
      setLoading(true);
      try {
        const [entRes, voteRes, judges, sponsors, inquiries, cls, myCls] = await Promise.all([
          base44.functions.invoke('myEntries', { user_email: user?.email }).catch(() => ({ data: { entries: [] } })),
          base44.functions.invoke('myVotes', { user_email: user?.email }).catch(() => ({ data: { count: 0 } })),
          base44.entities.JudgeProfile.filter({ user_id: user?.id }, '-created_date', 5).catch(() => []),
          base44.entities.SponsorProfile.filter({ user_id: user?.id }, '-created_date', 5).catch(() => []),
          base44.entities.PartnerInquiry.filter({ contact_email: user?.email }, '-created_date', 10).catch(() => []),
          challengeApi.listClasses(100).catch(() => []),
          user?.email ? challengeApi.myClasses(user.email).catch(() => []) : Promise.resolve([]),
        ]);
        setEntries(entRes?.data?.entries || []);
        setVotes(voteRes?.data?.count ?? 0);
        setJudge((judges || [])[0] || null);
        setSponsor((sponsors || [])[0] || null);
        setHostInquiries(inquiries || []);
        setRunning(cls || []);
        setEnrolled(myCls || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, user?.id, user?.email]);

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f9fb]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Welcome back{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Here's what needs your attention today.</p>

        {/* Tabs */}
        <div className="mt-6 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <TabBtn active={tab === 'home'} onClick={() => setTab('home')} icon={LayoutDashboard} color="#2e5bff">
            Home
          </TabBtn>
          <TabBtn active={tab === 'challenges'} onClick={() => setTab('challenges')} icon={Trophy} color="#f15249">
            Challenges
          </TabBtn>
          <TabBtn active={tab === 'classes'} onClick={() => setTab('classes')} icon={BookOpen} color="#0a8882">
            Classes
          </TabBtn>
          <TabBtn active={tab === 'messages'} onClick={() => setTab('messages')} icon={MessageSquare} color="#2e5bff">
            Messages
            {unread > 0 && (
              <span
                data-testid="user-unread-badge"
                className={`ml-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${tab === 'messages' ? 'bg-white/25 text-white' : 'bg-[#2e5bff] text-white'}`}
              >
                {unread}
              </span>
            )}
          </TabBtn>
        </div>

        {/* ── Home tab ─────────────────────────────────────────────── */}
        {tab === 'home' && (
          <div className="mt-8 space-y-8">
            <PortalPromo />
            <DashboardHome
              entries={entries}
              votes={votes}
              judge={judge}
              sponsor={sponsor}
              hostInquiries={hostInquiries}
              enrolled={enrolled}
              isAdmin={isAdmin}
              onGoToClasses={() => setTab('classes')}
            />
          </div>
        )}

        {/* ── Classes tab ───────────────────────────────────────────── */}
        {tab === 'classes' && (
          <div className="mt-8">
            <ClassesTab enrolled={enrolled} running={running} entries={entries} />
          </div>
        )}

        {/* ── Challenges tab ────────────────────────────────────────── */}
        {tab === 'challenges' && (
          <div className="mt-8">
            <ChallengesTab entries={entries} hostInquiries={hostInquiries} />
          </div>
        )}

        {/* ── Messages tab ──────────────────────────────────────────── */}
        {tab === 'messages' && (
          <div className="mt-8 max-w-3xl">
            <MessagesTab onRead={refreshUnread} />
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, color, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
        active ? 'text-white' : 'text-slate-500 hover:text-slate-900'
      }`}
      style={active ? { backgroundColor: color } : undefined}
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}