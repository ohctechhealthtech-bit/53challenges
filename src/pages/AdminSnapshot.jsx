/** /admin-snapshot — a one-glance admin view: active challenges, participants, entry status. */
import { useEffect, useState } from 'react';
import { Loader2, Trophy, Users, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SnapshotStatCard from '@/components/reporting/SnapshotStatCard';
import EntryStatusBreakdown from '@/components/reporting/EntryStatusBreakdown';

const ACTIVE = ['published', 'entry_open', 'voting_open'];

export default function AdminSnapshot() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    document.title = 'Reporting snapshot — 53 Challenges';
    (async () => {
      const [challenges, entries] = await Promise.all([
        base44.entities.Challenge.list('-created_date', 500),
        base44.entities.Entry.list('-created_date', 1000),
      ]);
      const counts = entries.reduce((acc, e) => {
        const k = e.status || 'pending';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      setStats({
        active: challenges.filter((c) => ACTIVE.includes(c.lifecycle_status)).length,
        totalChallenges: challenges.length,
        participants: new Set(entries.map((e) => e.creator_email || e.creator_name).filter(Boolean)).size,
        entries: entries.length,
        counts,
      });
      setLoading(false);
    })();
  }, []);

  return (
    <main className="py-12">
      <div className="container-tight">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight">Reporting snapshot</h1>
        <p className="mt-2 text-muted-foreground">Live totals across challenges, participants and entries.</p>

        {loading ? (
          <div className="mt-10 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading numbers…
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <SnapshotStatCard
                icon={Trophy}
                label="Active challenges"
                value={stats.active}
                hint={`${stats.totalChallenges} in total`}
              />
              <SnapshotStatCard
                icon={Users}
                label="Participants"
                value={stats.participants}
                hint="Unique people who have entered"
              />
              <SnapshotStatCard icon={FileText} label="Entries" value={stats.entries} hint="All entries received" />
            </div>

            <div className="mt-6">
              <EntryStatusBreakdown counts={stats.counts} total={stats.entries} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}