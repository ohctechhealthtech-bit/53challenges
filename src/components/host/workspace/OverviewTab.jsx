/**
 * Overview tab — live performance snapshot and notifications.
 */
import WorkspaceStats from '@/components/host/dashboard/WorkspaceStats';
import NotificationsPanel from '@/components/host/dashboard/NotificationsPanel';
import ApprovedChallengesPanel from '@/components/host/dashboard/ApprovedChallengesPanel';

export default function OverviewTab({ notifications, onChanged, hasLiveChallenge, approvedChallenges = [], onManageChallenge }) {
  return (
    <div className="space-y-6">
      <ApprovedChallengesPanel challenges={approvedChallenges} onManage={onManageChallenge} />
      <WorkspaceStats />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-heading text-lg font-bold">Live challenge performance</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {hasLiveChallenge
              ? 'Entries, votes and moderation counts update here as your challenge runs.'
              : 'No live challenges yet — approved challenges appear here with real-time entries, voting and moderation counts.'}
          </p>
        </div>
        <NotificationsPanel notifications={notifications} onChanged={onChanged} />
      </div>
    </div>
  );
}