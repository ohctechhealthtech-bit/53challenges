import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RefreshCw, Plus, CalendarPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import AdminTabStrip, { ADMIN_TABS, CHALLENGE_SCOPED } from '@/components/admin/AdminTabStrip';
import ChallengeSelect from '@/components/admin/ChallengeSelect';
import AllChallengesTab from '@/components/admin/AllChallengesTab';
import EntriesTab from '@/components/admin/EntriesTab';
import ResultsTab from '@/components/admin/ResultsTab';
import VotesTab from '@/components/admin/VotesTab';
import ExclusionsTab from '@/components/admin/ExclusionsTab';
import FundsTab from '@/components/admin/FundsTab';
import SponsorsTab from '@/components/admin/SponsorsTab';
import StatsTab from '@/components/admin/StatsTab';
import HostRequestsTab from '@/components/admin/HostRequestsTab';
import ApprovalsTab from '@/components/admin/ApprovalsTab';
import JudgesTab from '@/components/admin/JudgesTab';
import ScoringTab from '@/components/admin/ScoringTab';
import JudgePanelTab from '@/components/admin/JudgePanelTab';
import StageConfigTab from '@/components/admin/config/StageConfigTab';
import MastersTab from '@/components/admin/MastersTab';
import NotPorted from '@/components/admin/NotPorted';
import BrandingSettings from '@/components/dashboard/BrandingSettings';

export default function Dashboard() {
  const { user, isAuthenticated, navigateToLogin } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tab = params.get('tab') || 'challenges';
  const setTab = (t) => navigate(`/dashboard?tab=${t}`);

  const [challenges, setChallenges] = useState([]);
  const [reference, setReference] = useState(null);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openCreate, setOpenCreate] = useState(false);
  const [openSeason, setOpenSeason] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [approvalCount, setApprovalCount] = useState(0);
  const [judgeAppCount, setJudgeAppCount] = useState(0);

  const isAdmin = user?.role === 'admin' || user?.role === 'creator' || user?.is_admin === true;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, ref, reqs, approvals, judgeApps] = await Promise.all([
        adminChallengeApi.listChallenges({ sort: '-created_date' }),
        adminChallengeApi.reference().catch(() => ({ categories: [] })),
        adminChallengeApi.listHostRequests().catch(() => null),
        adminChallengeApi.listApprovals().catch(() => null),
        adminChallengeApi.judgeApplications({ status: 'pending' }).catch(() => null),
      ]);
      const rows = list.challenges || [];
      setChallenges(rows);
      setReference(ref);
      if (reqs) setRequestCount(reqs.unread_count ?? reqs.count ?? 0);
      if (approvals) setApprovalCount(approvals.pending_count ?? approvals.count ?? 0);
      if (judgeApps) setJudgeAppCount(judgeApps.unread_count ?? judgeApps.count ?? 0);
      setSelected((prev) => prev || rows[0]?.id || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) navigateToLogin();
  }, [isAuthenticated]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  // Auto-refresh: poll the parent API every 15 seconds so counts and queues stay live.
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(() => { load(); }, 15000);
    return () => clearInterval(interval);
  }, [isAdmin, load]);

  if (!isAuthenticated) return null;

  if (!isAdmin) {
    return (
      <div className="container-tight py-24 text-center">
        <p className="text-muted-foreground">You don't have access to the dashboard.</p>
      </div>
    );
  }

  const counts = {
    requests: requestCount,
    challenges: challenges.length,
    approvals: approvalCount,
    judges: judgeAppCount,
    entries: challenges.find((c) => c.id === selected)?.pending_count || 0,
  };
  const label = ADMIN_TABS.find((t) => t.key === tab)?.label || tab;

  return (
    <div className="container-tight py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold">Challenge Admin</h1>
          <p className="mt-2 text-muted-foreground">Everything waiting on you, in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
          </Button>
          <Button variant="outline" onClick={() => { setTab('stage'); setOpenSeason(true); }}>
            <CalendarPlus className="h-4 w-4" /> Create Season
          </Button>
          <Button onClick={() => { setTab('challenges'); setOpenCreate(true); }}>
            <Plus className="h-4 w-4" /> Add Challenge
          </Button>
        </div>
      </div>

      <AdminTabStrip tab={tab} counts={counts} onChange={setTab} />

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {CHALLENGE_SCOPED.has(tab) && (
        <ChallengeSelect challenges={challenges} value={selected} onChange={setSelected} />
      )}

      {tab === 'challenges' && (
        <AllChallengesTab
          categories={reference?.categories || []}
          reference={reference}
          onReload={load}
          openCreate={openCreate}
          onCreateHandled={() => setOpenCreate(false)}
        />
      )}

      {tab === 'requests' && <HostRequestsTab onCounts={setRequestCount} />}

      {tab === 'approvals' && (
        <ApprovalsTab challenges={challenges} actingEmail={user?.email} onCounts={setApprovalCount} />
      )}

      {tab === 'judges' && (
        <JudgesTab challenges={challenges} actingEmail={user?.email} onCounts={setJudgeAppCount} />
      )}

      {tab === 'entries' && <EntriesTab challengeId={selected} actingEmail={user?.email} />}

      {tab === 'scoring' && <ScoringTab challengeId={selected} actingEmail={user?.email} />}

      {tab === 'panel' && <JudgePanelTab challengeId={selected} actingEmail={user?.email} />}

      {tab === 'stage' && (
        <StageConfigTab
          challengeId={selected}
          categories={reference?.categories || []}
          actingEmail={user?.email}
          onReload={load}
          openCreateSeason={openSeason}
          onCreateSeasonHandled={() => setOpenSeason(false)}
        />
      )}

      {tab === 'masters' && <MastersTab />}

      {tab === 'results' && <ResultsTab challengeId={selected} />}

      {tab === 'votes' && <VotesTab challengeId={selected} />}

      {tab === 'exclusions' && <ExclusionsTab actingEmail={user?.email} />}

      {tab === 'funds' && <FundsTab challengeId={selected} actingEmail={user?.email} />}

      {tab === 'sponsors' && <SponsorsTab challengeId={selected} actingEmail={user?.email} />}

      {tab === 'stats' && <StatsTab challengeId={selected} actingEmail={user?.email} />}

      {tab === 'branding' && <div className="mt-6"><BrandingSettings /></div>}

      {!['challenges', 'branding', 'entries', 'results', 'votes', 'exclusions', 'funds', 'sponsors', 'stats', 'requests', 'approvals', 'judges', 'scoring', 'panel', 'stage', 'masters'].includes(tab) && <NotPorted label={label} />}
    </div>
  );
}