import { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import ScoreForm from '@/components/judging/ScoreForm';
import { submitCalibration } from '@/lib/judgeScoring';

// Calibration samples for panels the signed-in judge belongs to.
export default function CalibrationList({ panels, calibration, onDone }) {
  const [active, setActive] = useState(null);
  const [error, setError] = useState('');

  const inCalibration = (panels || []).filter(
    (p) => (p.status === 'calibration' || p.status === 'draft') && (p.calibration_entry_ids || []).length > 0
  );
  if (!inCalibration.length) return null;

  const submit = async (scores) => {
    setError('');
    try {
      await submitCalibration({ panelId: active.panel.id, entryId: active.entryId, scores });
      setActive(null);
      onDone?.();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {inCalibration.map((panel) => (
        <div key={panel.id} className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-heading text-lg font-bold">{panel.competition_title}</h3>
          <p className="text-xs text-muted-foreground">Calibration round — score the samples so the panel aligns.</p>
          <div className="mt-3 space-y-2">
            {panel.calibration_entry_ids.map((eid) => {
              const done = (calibration || []).some((c) => c.panel_id === panel.id && c.entry_id === eid);
              return (
                <div key={eid} className="flex items-center justify-between rounded-lg border border-border bg-white/5 px-3 py-2">
                  <span className="text-sm">Sample {done && <CheckCircle2 className="inline h-4 w-4 text-emerald-400" />}</span>
                  {!done && (
                    <button onClick={() => setActive({ panel, entryId: eid })}
                      className="rounded-lg grad-bg px-3 py-1 text-xs font-bold text-white">Score sample</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {active && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={() => setActive(null)}>
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-border bg-card p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-xl font-extrabold">Calibration sample</h3>
              <button onClick={() => setActive(null)} className="text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <div className="mt-4">
              <ScoreForm criteria={active.panel.criteria} scaleMax={active.panel.scale_max || 10}
                onSubmit={(scores) => submit(scores)} submitLabel="Submit sample scores" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}