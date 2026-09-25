import { useCallback, useEffect, useState } from 'react';
import SectionToolbar from '@/components/admin/SectionToolbar';
import StageTrackerPanel from './StageTrackerPanel';
import InfluencePanel from './InfluencePanel';
import SeasonPipelinePanel from './SeasonPipelinePanel';
import CreateSeasonDialog from './CreateSeasonDialog';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import { formatDate } from './configMeta';

export default function StageConfigTab({ challengeId, categories, actingEmail, onReload, openCreateSeason, onCreateSeasonHandled }) {
  const [config, setConfig] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!challengeId) { setConfig(null); setPipeline(null); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const [cfg, sp] = await Promise.all([
        adminChallengeApi.configGet({ challengeId }),
        adminChallengeApi.configSeasonPipeline({ challengeId }),
      ]);
      setConfig(cfg);
      setPipeline(sp);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => { load(); }, [load]);

  const reload = async () => { await load(); onReload?.(); };
  const scrutineer = config?.scrutineer;

  return (
    <>
      <SectionToolbar
        section="config"
        challengeId={challengeId}
        title="Stage & config"
        description="Where the round is up to, how judges and the public influence the result, and this challenge's place in the season."
      />

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {!challengeId ? (
        <p className="mt-4 text-sm text-muted-foreground">Pick a challenge above to load its stage and configuration.</p>
      ) : loading ? (
        <p className="mt-5 text-sm text-muted-foreground">Loading the configuration…</p>
      ) : config ? (
        <>
          <StageTrackerPanel
            challengeId={challengeId}
            tracker={config.stage_tracker}
            actingEmail={actingEmail}
            onChanged={reload}
          />

          <InfluencePanel
            key={JSON.stringify(config.judging_influence.values)}
            challengeId={challengeId}
            influence={config.judging_influence}
            actingEmail={actingEmail}
            onSaved={reload}
          />

          <SeasonPipelinePanel
            challengeId={challengeId}
            data={pipeline}
            actingEmail={actingEmail}
            onChanged={reload}
          />

          <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5">
            <h3 className="font-heading text-base font-bold">Scrutineer sign-off</h3>
            {scrutineer?.applies ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {scrutineer.scrutineer_name
                  ? `Signed off by ${scrutineer.scrutineer_name} on ${formatDate(scrutineer.scrutineer_signoff_date)}.`
                  : 'Not signed off yet — record it from the Judge scoring tab.'}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Scrutineer review only applies to a grand-final challenge.
              </p>
            )}
          </section>
        </>
      ) : null}

      {openCreateSeason && (
        <CreateSeasonDialog
          open={openCreateSeason}
          onOpenChange={(v) => !v && onCreateSeasonHandled()}
          categories={categories}
          actingEmail={actingEmail}
          onCreated={async () => { onCreateSeasonHandled(); await reload(); }}
        />
      )}
    </>
  );
}