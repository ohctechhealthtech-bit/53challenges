import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { listPipeline, updatePipelineStatus } from '@/lib/marketing';
import FollowUpDraft from './FollowUpDraft';

const STAGES = ['new', 'contacted', 'replied', 'in_discussion', 'confirmed', 'live', 'completed', 'declined'];
const STAGE_LABEL = {
  new: 'New', contacted: 'Contacted', replied: 'Replied', in_discussion: 'In discussion',
  confirmed: 'Confirmed', live: 'Live', completed: 'Completed', declined: 'Declined',
};
const STAGE_COLOR = {
  new: 'bg-slate-500/15 text-slate-300', contacted: 'bg-blue-500/15 text-blue-300',
  replied: 'bg-cyan-500/15 text-cyan-300', in_discussion: 'bg-amber-500/15 text-amber-300',
  confirmed: 'bg-sky-500/15 text-sky-300', live: 'bg-emerald-500/15 text-emerald-300',
  completed: 'bg-violet-500/15 text-violet-300', declined: 'bg-red-500/15 text-red-300',
};

export default function PipelineList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const d = await listPipeline();
      if (d?.error) throw new Error(d.error);
      setItems(d.items || []);
    } catch (e) {
      setError(e?.message || 'Could not load the outreach pipeline.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const setStage = async (id, stage) => {
    setSavingId(id);
    setError('');
    try {
      const d = await updatePipelineStatus(id, stage);
      if (d?.error) throw new Error(d.error);
      setItems((list) => list.map((i) => (i.id === id ? { ...i, pipeline_status: stage } : i)));
    } catch (e) {
      setError(e?.message || 'Could not update the stage.');
    } finally {
      setSavingId('');
    }
  };

  const pipeline = (items || []).filter((i) => i.pipeline_status);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-xl font-bold">Creator & partner outreach</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sponsor, council, school and workplace inquiries. Move each through the outreach stages as conversations progress.</p>
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : (
        <div className="space-y-3">
          {pipeline.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{i.challenge_title || i.company_name || 'Untitled'}</p>
                <p className="text-xs text-muted-foreground">{i.company_name} · {i.contact_email}{i.organisation_kind ? ` · ${i.organisation_kind}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STAGE_COLOR[i.pipeline_status] || STAGE_COLOR.new}`}>
                  {STAGE_LABEL[i.pipeline_status] || i.pipeline_status}
                </span>
                <select
                  className="c53-input w-auto py-1.5 text-xs"
                  value={i.pipeline_status}
                  disabled={savingId === i.id}
                  onChange={(e) => setStage(i.id, e.target.value)}
                  aria-label={`Stage for ${i.company_name || 'inquiry'}`}
                >
                  {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                </select>
                {savingId === i.id && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>
              <FollowUpDraft inquiryId={i.id} />
            </div>
          ))}
          {!pipeline.length && <p className="text-sm text-muted-foreground">No outreach inquiries yet. Share the /host-a-challenge page to start the pipeline.</p>}
        </div>
      )}
    </div>
  );
}