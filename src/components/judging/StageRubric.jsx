import { useState } from 'react';
import { Plus, Trash2, Save, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { audit } from '@/lib/judging';

// Rubric editor: criteria with name, description, weight and 1–10 scale.
export default function StageRubric({ panel, onChange, actor }) {
  const [criteria, setCriteria] = useState(panel.criteria?.length ? panel.criteria : [{ name: 'Craft', description: '', weight: 1 }]);
  const [jw, setJw] = useState(panel.judge_weight ?? 0.7);
  const [pw, setPw] = useState(panel.public_weight ?? 0.3);
  const [visible, setVisible] = useState(panel.weighting_visible ?? true);
  const [busy, setBusy] = useState(false);

  const update = (i, field, v) => setCriteria((c) => c.map((row, idx) => idx === i ? { ...row, [field]: v } : row));
  const add = () => setCriteria((c) => [...c, { name: '', description: '', weight: 1 }]);
  const remove = (i) => setCriteria((c) => c.filter((_, idx) => idx !== i));

  const save = async () => {
    setBusy(true);
    try {
      const totalWeight = criteria.reduce((a, c) => a + (Number(c.weight) || 0), 0);
      const updated = await base44.entities.JudgingPanel.update(panel.id, { criteria, scale_max: panel.scale_max || 10, judge_weight: Number(jw) || 0.7, public_weight: Number(pw) || 0.3, weighting_visible: visible, tie_breaker_index: totalWeight ? 0 : 0 });
      await audit(panel.id, actor, 'rubric_saved', `${criteria.length} criteria · ${(jw*100).toFixed(0)}/${(pw*100).toFixed(0)} weighting`);
      onChange(updated);
    } finally { setBusy(false); }
  };

  const goToCalibration = async () => {
    if (panel.status === 'draft') {
      setBusy(true);
      try {
        const updated = await base44.entities.JudgingPanel.update(panel.id, { status: 'calibration' });
        await audit(panel.id, actor, 'stage_calibration_started');
        onChange(updated);
      } finally { setBusy(false); }
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold">Rubric</h3>
          <span className="text-xs text-muted-foreground">Scale 1–{panel.scale_max || 10}</span>
        </div>
        <p className="text-sm text-muted-foreground">Define criteria, weightings and descriptions judges score against.</p>
      </div>

      {criteria.map((c, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-2">
            <input value={c.name} onChange={(e) => update(i, 'name', e.target.value)} placeholder="Criterion name"
              className="flex-1 rounded-lg border border-input bg-white/5 px-3 py-2 text-sm font-semibold" />
            <label className="flex items-center gap-1.5 rounded-lg border border-input bg-white/5 px-2 py-2 text-sm">
              <span className="text-xs text-muted-foreground">Weight</span>
              <input type="number" min={0} step={0.5} value={c.weight} onChange={(e) => update(i, 'weight', e.target.value)}
                className="w-14 bg-transparent text-sm font-bold outline-none" />
            </label>
            <button onClick={() => remove(i)} className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
          <textarea value={c.description} onChange={(e) => update(i, 'description', e.target.value)} rows={2} placeholder="What judges should look for…"
            className="mt-2 w-full rounded-lg border border-input bg-white/5 px-3 py-2 text-xs" />
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={add} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-muted"><Plus className="h-4 w-4" /> Add criterion</button>
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" /> Save rubric</button>
        {panel.status === 'draft' && (
          <button onClick={goToCalibration} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-primary px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10"><ArrowRight className="h-4 w-4" /> Start calibration</button>
        )}

        {/* Combined weighting */}
        <div className="w-full rounded-xl border border-border bg-card p-4">
          <h4 className="font-semibold">Combined results weighting</h4>
          <p className="text-xs text-muted-foreground">Final score = judging × w₁ + public vote × w₂. Defaults 70 / 30. Shown publicly on the competition page when visible.</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5 rounded-lg border border-input bg-white/5 px-2.5 py-2">
              <span className="text-xs text-muted-foreground">Judges</span>
              <input type="number" min={0} max={1} step={0.05} value={jw} onChange={(e) => setJw(e.target.value)} className="w-14 bg-transparent font-bold outline-none" />
              <span className="text-xs text-muted-foreground">%</span>
            </label>
            <label className="flex items-center gap-1.5 rounded-lg border border-input bg-white/5 px-2.5 py-2">
              <span className="text-xs text-muted-foreground">Public</span>
              <input type="number" min={0} max={1} step={0.05} value={pw} onChange={(e) => setPw(e.target.value)} className="w-14 bg-transparent font-bold outline-none" />
              <span className="text-xs text-muted-foreground">%</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="accent-purple-500" /> Show weighting publicly
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}