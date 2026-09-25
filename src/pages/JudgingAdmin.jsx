import { useEffect, useState } from 'react';
import { Loader2, Plus, Gavel, ChevronRight, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { challengeApi } from '@/lib/challengeApi';
import { audit } from '@/lib/judging';
import StagePanel from '@/components/judging/StagePanel';
import StageRubric from '@/components/judging/StageRubric';
import StageCalibration from '@/components/judging/StageCalibration';
import StageScoring from '@/components/judging/StageScoring';
import StageResults from '@/components/judging/StageResults';
import { useAuth } from '@/lib/AuthContext';

const STAGES = ['draft', 'calibration', 'scoring', 'locked', 'complete'];

export default function JudgingAdmin() {
  const { user } = useAuth();
  const actor = user?.email || 'admin';
  const [panels, setPanels] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newComp, setNewComp] = useState('');
  const [newJW, setNewJW] = useState(0.7);
  const [newPW, setNewPW] = useState(0.3);

  const load = async () => {
    setLoading(true);
    try {
      const [pl, chRes] = await Promise.all([
        base44.entities.JudgingPanel.list('-created_date', 100),
        challengeApi.listChallenges({ status: 'active', limit: 200 }),
      ]);
      setPanels(pl || []);
      setCompetitions(chRes?.challenges || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const createPanel = async () => {
    if (!newComp) return;
    const comp = competitions.find((c) => c.id === newComp);
    const created = await base44.entities.JudgingPanel.create({
      competition_id: comp.id,
      competition_title: comp.title || comp.theme || '',
      competition_category: comp.category || '',
      judge_profile_ids: [],
      criteria: [],
      scale_max: 10,
      judge_weight: Number(newJW) || 0.7,
      public_weight: Number(newPW) || 0.3,
      weighting_visible: true,
      status: 'draft',
    });
    await audit(created.id, actor, 'panel_created', comp.title || comp.theme || '');
    setCreating(false); setNewComp(''); setNewJW(0.7); setNewPW(0.3);
    await load();
    setSelected(created);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="container-tight py-12">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary"><Gavel className="h-5 w-5" /></span>
        <div>
          <h1 className="font-heading text-3xl font-extrabold">Judging Workspace</h1>
          <p className="text-sm text-muted-foreground">Assemble panels, define rubrics, run calibration and scoring, audit every action.</p>
        </div>
      </div>

      {!selected ? (
        <>
          <div className="mt-6 flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold">Judging panels</h2>
            <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> New panel</button>
          </div>
          {panels.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">No judging panels yet.</div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {panels.map((p) => (
                <button key={p.id} onClick={() => setSelected(p)} className="text-left rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
                  <div className="flex items-center justify-between">
                    <p className="font-bold line-clamp-1">{p.competition_title || p.competition_id}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{p.judge_profile_ids?.length || 0} judges · {p.head_judge_name ? 'Head: ' + p.head_judge_name : 'No head judge'}</p>
                  <span className="mt-2 inline-block rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold capitalize text-primary">{p.status}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div>
          <button onClick={() => setSelected(null)} className="mt-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /> Back to panels</button>
          <h2 className="mt-3 font-heading text-2xl font-extrabold">{selected.competition_title || selected.competition_id}</h2>
          <div className="mt-3 inline-flex gap-1 rounded-xl border border-border bg-card p-1">
            {STAGES.map((s) => {
              const reached = STAGES.indexOf(selected.status) >= STAGES.indexOf(s);
              return <span key={s} className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize ${selected.status === s ? 'bg-primary text-primary-foreground' : reached ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>{s}</span>;
            })}
          </div>

          <div className="mt-6 rounded-3xl border border-border bg-card p-6">
            <WorkspacePanel panel={selected} actor={actor} onChange={(u) => setSelected({ ...selected, ...u })} />
          </div>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setCreating(false)}>
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading text-lg font-bold">Create judging panel</h3>
            <p className="text-sm text-muted-foreground">Select an active competition.</p>
            <select value={newComp} onChange={(e) => setNewComp(e.target.value)} className="mt-4 w-full rounded-xl border border-input bg-white/5 px-3 py-2.5 text-sm">
              <option value="">Select…</option>
              {competitions.map((c) => <option key={c.id} value={c.id}>{c.title || c.theme}</option>)}
            </select>
            <p className="mt-4 text-xs font-semibold text-muted-foreground">Combined weighting</p>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <label className="flex items-center gap-1.5 rounded-lg border border-input bg-white/5 px-2 py-2">
                <span className="text-xs text-muted-foreground">Judges</span>
                <input type="number" min={0} max={1} step={0.05} value={newJW} onChange={(e) => setNewJW(e.target.value)} className="w-14 bg-transparent font-bold outline-none" />
                <span className="text-xs text-muted-foreground">%</span>
              </label>
              <label className="flex items-center gap-1.5 rounded-lg border border-input bg-white/5 px-2 py-2">
                <span className="text-xs text-muted-foreground">Public</span>
                <input type="number" min={0} max={1} step={0.05} value={newPW} onChange={(e) => setNewPW(e.target.value)} className="w-14 bg-transparent font-bold outline-none" />
                <span className="text-xs text-muted-foreground">%</span>
              </label>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Defaults 70% judges / 30% public vote. Editable later from the Rubric stage.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setCreating(false)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">Cancel</button>
              <button onClick={createPanel} disabled={!newComp} className="rounded-xl grad-bg px-5 py-2 text-sm font-bold text-white disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspacePanel({ panel, actor, onChange }) {
  if (panel.status === 'draft') {
    // allow both panel assembly and rubric editing while in draft
    return (
      <div className="space-y-8">
        <StagePanel panel={panel} actor={actor} onChange={onChange} />
        <StageRubric panel={panel} actor={actor} onChange={onChange} />
      </div>
    );
  }
  if (panel.status === 'calibration') return (
    <div className="space-y-8">
      <StageRubric panel={panel} actor={actor} onChange={onChange} />
      <StageCalibration panel={panel} actor={actor} onChange={onChange} />
    </div>
  );
  if (panel.status === 'scoring') return <StageScoring panel={panel} actor={actor} onChange={onChange} />;
  if (panel.status === 'locked' || panel.status === 'complete') {
    return (
      <div className="space-y-8">
        <StageScoring panel={panel} actor={actor} onChange={onChange} />
        <StageResults panel={panel} actor={actor} onChange={onChange} />
      </div>
    );
  }
  return null;
}