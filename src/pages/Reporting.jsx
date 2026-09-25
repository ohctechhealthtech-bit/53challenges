import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getReports, getChallengeReport } from '@/lib/reporting';
import { challengeApi } from '@/lib/challengeApi';
import StatCards from '@/components/reporting/StatCards';
import CompetitionPanel from '@/components/reporting/CompetitionPanel';
import ModerationPanel from '@/components/reporting/ModerationPanel';
import JudgePanel from '@/components/reporting/JudgePanel';
import AudiencePanel from '@/components/reporting/AudiencePanel';
import CampaignPanel from '@/components/reporting/CampaignPanel';
import PipelinePanel from '@/components/reporting/PipelinePanel';
import ChallengeSelector from '@/components/reporting/ChallengeSelector';
import ChallengeReportView from '@/components/reporting/ChallengeReportView';

export default function Reporting() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [challenges, setChallenges] = useState([]);
  const [challengesLoading, setChallengesLoading] = useState(true);
  const [selected, setSelected] = useState('');
  const [scoped, setScoped] = useState(null);
  const [scopedLoading, setScopedLoading] = useState(false);
  const [scopedError, setScopedError] = useState('');
  const isAdmin = user?.role === 'admin' || user?.role === 'creator' || user?.is_admin === true;

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    (async () => {
      try {
        const [rep, ch] = await Promise.all([
          getReports(),
          challengeApi.listChallenges({ limit: 200 }).catch(() => ({ challenges: [] })),
        ]);
        setData(rep);
        setChallenges(ch.challenges || []);
      } catch (e) { setError(e?.message || 'Failed to load reports'); }
      finally { setLoading(false); setChallengesLoading(false); }
    })();
  }, [isAdmin]);

  useEffect(() => {
    if (!selected) { setScoped(null); setScopedError(''); return; }
    setScopedLoading(true); setScopedError(''); setScoped(null);
    getChallengeReport(selected)
      .then((r) => setScoped(r))
      .catch((e) => setScopedError(e?.message || 'Failed to load challenge report'))
      .finally(() => setScopedLoading(false));
  }, [selected]);

  if (!isAdmin) return <div className="container-tight py-24 text-center text-muted-foreground">Admins only.</div>;
  if (loading) return <div className="container-tight py-24 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>;
  if (error || !data) return <div className="container-tight py-24 text-center text-destructive">{error || 'No data.'}</div>;

  return (
    <div className="container-tight py-12">
      <h1 className="font-heading text-3xl font-extrabold">Reporting</h1>
      <p className="mt-2 text-muted-foreground">
        {selected ? 'Scoped report for the selected challenge.' : 'Platform-wide performance snapshot. Competition & entry data covers the most recent 12 competitions.'}
      </p>

      <div className="mt-4">
        <ChallengeSelector challenges={challenges} value={selected} onChange={setSelected} loading={challengesLoading} />
      </div>

      {selected ? (
        scopedLoading ? (
          <div className="mt-12 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
        ) : scopedError ? (
          <div className="mt-12 text-center text-destructive">{scopedError}</div>
        ) : scoped ? (
          <ChallengeReportView report={scoped} />
        ) : null
      ) : (
        <>
          <div className="mt-6"><StatCards summary={data.summary} moderation={data.moderation} audience={data.audience} /></div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <CompetitionPanel byCompetition={data.entriesByCompetition} byState={data.entriesByState} />
            <ModerationPanel moderation={data.moderation} />
            <JudgePanel judges={data.judges} consistency={data.consistency} />
            <AudiencePanel audience={data.audience} />
            <CampaignPanel campaigns={data.campaigns} />
            <PipelinePanel pipeline={data.pipeline} />
          </div>
        </>
      )}
    </div>
  );
}