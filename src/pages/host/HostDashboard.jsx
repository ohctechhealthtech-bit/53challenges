/**
 * My Host Workspace — one place for everything a host needs:
 * hosting a challenge, tracking requests, packages, services, campaign,
 * team, messages and billing.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2, Building2 } from 'lucide-react';
import { hostPortal } from '@/lib/hostPortalClient';
import { useAuth } from '@/lib/AuthContext';
import HostSignInGate from '@/components/host/HostSignInGate';
import { getHostRole } from '@/components/host/hostRoles';
import ProposalsPanel from '@/components/host/dashboard/ProposalsPanel';
import ContentApprovalQueue from '@/components/moderation/ContentApprovalQueue';
import ProposalDetail from '@/components/host/dashboard/ProposalDetail';
import InvoicesPanel from '@/components/host/dashboard/InvoicesPanel';
import WorkspaceTabs from '@/components/host/workspace/WorkspaceTabs';
import HostAChallengeTab from '@/components/host/workspace/HostAChallengeTab';
import MyHostRequestsPanel from '@/components/host/requests/MyHostRequestsPanel';
import OverviewTab from '@/components/host/workspace/OverviewTab';
import PackageTab from '@/components/host/workspace/PackageTab';
import ServicesTab from '@/components/host/workspace/ServicesTab';
import CampaignTab from '@/components/host/workspace/CampaignTab';
import TeamTab from '@/components/host/workspace/TeamTab';
import MessagesTab from '@/components/host/workspace/MessagesTab';

export default function HostDashboard() {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  // Admins review participant content on the admin Dashboard, so the review
  // queue never doubles up here — hosts see it only in their own workspace.
  const isAdmin = user?.role === 'admin' || user?.is_admin === true;
  const [workspace, setWorkspace] = useState(null);
  const [approvedChallenges, setApprovedChallenges] = useState([]);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState(null);
  const { search } = useLocation();
  const fromPackage = !!new URLSearchParams(search).get('package');

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      // Organisation first — if the signed-in host already has one we never
      // show the registration form again.
      const org = await hostPortal('get_organisation');
      const data = await hostPortal('get_workspace');
      const paid = !!org?.has_paid_application;
      setWorkspace(org?.has_organisation
        ? { ...data, no_workspace: false, has_paid_application: paid, organisation: data.organisation || org.organisation }
        : { ...data, has_paid_application: paid });
      setError('');
      const live = await hostPortal('get_approved_challenges').catch(() => ({ challenges: [] }));
      setApprovedChallenges(live?.challenges || []);
    } catch (e) {
      setError(e?.message || 'Could not load your workspace');
    }
  }, [isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  if (isLoadingAuth) {
    return (
      <main className="container-tight flex min-h-[50vh] items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!isAuthenticated) return <HostSignInGate />;

  if (error) {
    return (
      <main className="container-tight py-14">
        <p className="text-center text-sm text-destructive">{error}</p>
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="container-tight flex min-h-[50vh] items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (workspace.no_workspace) {
    return (
      <main className="container-tight py-10 sm:py-14">
        <div className="mb-8">
          <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold sm:text-4xl">
            <Building2 className="h-7 w-7 text-primary" aria-hidden="true" />
            Your host workspace
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Start your challenge application below — we'll set your workspace up along the way.
          </p>
        </div>
        <HostAChallengeTab />
        <MyHostRequestsPanel />
      </main>
    );
  }

  const { organisation, member, proposals = [], invoices = [], notifications = [], team = [], addons = [] } = workspace;
  const role = getHostRole(member?.role);
  const unread = notifications.filter((n) => !n.read).length;
  const currentPackage = proposals.find((p) => p.delivery_level)?.delivery_level || '';
  const approved = proposals.some((p) => ['approved', 'approved_and_signed', 'live'].includes(p.review_status));
  const hasLive = proposals.some((p) => p.challenge_id);

  // Until a challenge application has been paid for, the workspace is not
  // unlocked yet — the host just sees their organisation and the apply wizard.
  if (!workspace.has_paid_application) {
    return (
      <main className="container-tight py-10 sm:py-14">
        <div className="mb-8">
          <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold sm:text-4xl">
            <Building2 className="h-7 w-7 text-primary" aria-hidden="true" />
            {organisation?.name || 'Your workspace'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your full workspace — challenges, team, campaign and billing — opens once your first challenge
            application is paid for.
          </p>
        </div>
        {!isAdmin && (
          <div className="mb-6">
            <ContentApprovalQueue scope="host" />
          </div>
        )}
        <HostAChallengeTab />
        <MyHostRequestsPanel />
      </main>
    );
  }

  const activeTab = tab || (fromPackage || proposals.length === 0 ? 'host' : 'overview');

  const TABS = [
    { key: 'host', label: 'Host a challenge' },
    { key: 'overview', label: 'Overview', badge: unread },
    { key: 'challenges', label: 'My challenges' },
    { key: 'package', label: 'Package' },
    { key: 'services', label: 'Services' },
    { key: 'campaign', label: 'Campaign' },
    { key: 'team', label: 'Team' },
    { key: 'messages', label: 'Messages' },
    { key: 'billing', label: 'Billing' },
  ];

  return (
    <main className="container-tight py-10 sm:py-14">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold sm:text-4xl">
          <Building2 className="h-7 w-7 text-primary" aria-hidden="true" />
          {organisation?.name || 'Your workspace'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Host workspace · You are the <span className="font-semibold text-foreground">{role.name}</span>
        </p>
      </div>

      {!isAdmin && (
        <div className="mb-6">
          <ContentApprovalQueue scope="host" />
        </div>
      )}

      <WorkspaceTabs tabs={TABS} active={activeTab} onChange={setTab} />

      {activeTab === 'host' && <HostAChallengeTab />}
      {activeTab === 'overview' && (
        <OverviewTab
          notifications={notifications}
          onChanged={load}
          hasLiveChallenge={hasLive}
          approvedChallenges={approvedChallenges}
          onManageChallenge={(id) => { setSelectedId(id); setTab('challenges'); }}
        />
      )}
      {activeTab === 'challenges' && (
        selectedId ? (
          <ProposalDetail proposalId={selectedId} onBack={() => setSelectedId(null)} />
        ) : (
          <>
            <ProposalsPanel proposals={proposals} selectedId={selectedId} onSelect={setSelectedId} />
            <MyHostRequestsPanel />
          </>
        )
      )}
      {activeTab === 'package' && <PackageTab currentPackage={currentPackage} />}
      {activeTab === 'services' && <ServicesTab addons={addons} />}
      {activeTab === 'campaign' && <CampaignTab unlocked={approved} />}
      {activeTab === 'team' && <TeamTab team={team} />}
      {activeTab === 'messages' && <MessagesTab notifications={notifications} />}
      {activeTab === 'billing' && <InvoicesPanel invoices={invoices} />}
    </main>
  );
}