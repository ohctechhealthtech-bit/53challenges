// /judge — the Judging Control Room. Sidebar + round header + KPI cards +
// the active tab. All data flows through the parent Judge API via the
// judgeApi backend proxy.
import { useCallback, useEffect, useState } from 'react';
import { judgeApi, pickList, pickNum } from '@/lib/judgeApi';
import { mergeRubric } from '@/lib/judgeRubric';
import { setAttestationJudge } from '@/lib/judgeAttestation';
import JudgeSidebar from '@/components/judge/JudgeSidebar';
import JudgeRoundHeader from '@/components/judge/JudgeRoundHeader';
import JudgeKpiCards from '@/components/judge/JudgeKpiCards';
import AssignmentsTab from '@/components/judge/AssignmentsTab';
import EntriesTab from '@/components/judge/EntriesTab';
import JudgeReelsModal from '@/components/judge/reels/JudgeReelsModal';
import PanelProgressTab from '@/components/judge/PanelProgressTab';
import VarianceAlertsTab from '@/components/judge/VarianceAlertsTab';
import ResultsTab from '@/components/judge/ResultsTab';
import PoliciesTab from '@/components/judge/PoliciesTab';
import { PanelLoading, PanelError, SetupNotice } from '@/components/judge/PanelStates';

export default function JudgeControlRoom() {
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [roundId, setRoundId] = useState('');
  const [overview, setOverview] = useState(null);
  const [criteria, setCriteria] = useState(null);
  const [tab, setTab] = useState('assignments');
  const [reelOpen, setReelOpen] = useState(false);
  const [reelCategory, setReelCategory] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Judge identity + assigned rounds.
  useEffect(() => {
    judgeApi('judge-profile')
      .then((d) => {
        const p = d.judge || d.profile || d;
        setProfile(p);
        setAttestationJudge(p?.email);
        const rs = pickList(d, ['rounds', 'assignments', 'challenges']);
        setRounds(rs);
        if (rs.length) setRoundId(String(rs[0].round_id || rs[0].id));
      })
      .catch((e) => setProfileError(e));
  }, []);

  // Header KPIs are judge-wide (all rounds), matching the parent app's screen.
  const loadOverview = useCallback(() => {
    setRefreshing(true);
    judgeApi('judge-overview')
      .then((d) => setOverview(d.overview || d))
      .catch(() => setOverview(null))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    if (profile) loadOverview();
  }, [profile, loadOverview, refreshKey]);

  useEffect(() => {
    if (!roundId) return;
    judgeApi('judge-rubric', { round_id: roundId })
      .then((d) => setCriteria(mergeRubric(d.rubric || d)))
      .catch(() => setCriteria(null));
  }, [roundId]);

  const refresh = () => setRefreshKey((k) => k + 1);
  const openReel = (category = '') => {
    setReelCategory(category);
    setReelOpen(true);
  };

  if (profileError) {
    if (profileError.setup) return <div className="container-tight py-10"><SetupNotice /></div>;
    return (
      <div className="container-tight max-w-xl py-16">
        <PanelError message={profileError.message} onRetry={() => window.location.reload()} />
      </div>
    );
  }
  if (!profile) return <div className="py-20"><PanelLoading label="Opening your judging workspace…" /></div>;

  const counts = {
    assignments: pickNum(overview, ['active_assignments', 'assignments', 'assignment_count'], rounds.length),
    remaining: pickNum(overview, ['entries_remaining', 'remaining'], null) ?? undefined,
    alerts: pickNum(overview, ['variance_alerts', 'alerts'], null) ?? undefined,
  };

  return (
    <div className="container-tight py-8">
      <h1 className="font-heading text-2xl font-extrabold">Judging Control Room</h1>
      <p className="mt-1 text-sm text-muted-foreground">Score entries, track your panel and follow the results.</p>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <JudgeSidebar judge={profile} tab={tab} onTab={setTab} onOpenReel={() => openReel()} counts={counts} />

        <main className="min-w-0 flex-1 space-y-4">
          <JudgeRoundHeader
            rounds={rounds}
            roundId={roundId}
            onRound={setRoundId}
            overview={overview}
            refreshing={refreshing}
            onRefresh={refresh}
            onOpenReel={() => openReel()}
          />
          <JudgeKpiCards overview={overview} />

          {tab === 'assignments' && (
            <AssignmentsTab
              refreshKey={refreshKey}
              onJudge={(row) => {
                const rid = row.round_id || row.id;
                if (rid) setRoundId(String(rid));
                openReel();
              }}
            />
          )}
          {tab === 'entries' && (
            <EntriesTab roundId={roundId} criteria={criteria} refreshKey={refreshKey} onScored={refresh} />
          )}
          {tab === 'panel' && <PanelProgressTab refreshKey={refreshKey} />}
          {tab === 'variance' && <VarianceAlertsTab refreshKey={refreshKey} />}
          {tab === 'results' && <ResultsTab refreshKey={refreshKey} />}
          {tab === 'policies' && <PoliciesTab refreshKey={refreshKey} />}
        </main>
      </div>

      <JudgeReelsModal
        open={reelOpen}
        roundId={roundId}
        criteria={criteria}
        onClose={() => { setReelOpen(false); refresh(); }}
      />

    </div>
  );
}