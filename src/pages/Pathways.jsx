import { useEffect, useState } from 'react';
import { Loader2, Plus, Network, RefreshCw, ArrowUpCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { listPathwaysAdmin, computeStandings, promoteWinners, getSeriesStandings } from '@/lib/pathways';
import { listCompetitions } from '@/lib/audit';
import PathwayEditor from '@/components/pathways/PathwayEditor';
import PathwayStandings from '@/components/pathways/PathwayStandings';

export default function Pathways() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [pathways, setPathways] = useState([]);
  const [members, setMembers] = useState([]);
  const [comps, setComps] = useState([]);
  const [selId, setSelId] = useState('');
  const [loading, setLoading] = useState(true);
  const [rel, setRel] = useState(0);
  const [standings, setStandings] = useState([]);
  const [busy, setBusy] = useState('');

  const load = async () => {
    const [data, c] = await Promise.all([listPathwaysAdmin(), listCompetitions()]);
    setPathways(data.pathways || []);
    setMembers(data.members || []);
    setComps(c || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [rel]);

  const selected = pathways.find((p) => p.id === selId) || null;
  const selectedMembers = members.filter((m) => m.pathway_id === selId);

  useEffect(() => {
    if (!selected) { setStandings([]); return; }
    if (selected.type === 'series_championship') getSeriesStandings(selected.id).then(setStandings);
    else setStandings([]);
  }, [selId, rel, selected?.type]);

  const recompute = async () => { setBusy('compute'); try { await computeStandings(selected.id); setRel((n) => n + 1); } finally { setBusy(''); } };
  const promoteAll = async () => {
    const qs = selectedMembers.filter((m) => m.promotion_to_challenge_id);
    setBusy('promote'); try {
      for (const m of qs) { await promoteWinners(m.challenge_id); }
      setRel((n) => n + 1);
    } finally { setBusy(''); }
  };

  if (!isAdmin) return <div className="container-tight py-24 text-center text-muted-foreground">Pathway management is restricted to admins.</div>;

  return (
    <div className="container-tight py-10">
      <div className="flex items-center gap-2">
        <Network className="h-7 w-7 text-primary" />
        <h1 className="font-heading text-3xl font-extrabold">Pathways, Series & Rankings</h1>
      </div>
      <p className="mt-2 text-muted-foreground">Build national/state pathways, qualifier feeders, series championships and restricted-entry invites.</p>

      {loading ? <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* List */}
          <div className="space-y-2">
            <button onClick={() => setSelId('')} className="flex w-full items-center gap-2 rounded-xl border border-primary bg-primary/10 px-3 py-2.5 text-sm font-bold text-primary hover:bg-primary/15">
              <Plus className="h-4 w-4" /> New pathway
            </button>
            {pathways.map((p) => (
              <button key={p.id} onClick={() => setSelId(p.id)} className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition ${selId === p.id ? 'border-primary bg-card' : 'border-border bg-card/60 hover:bg-muted'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold">{p.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{p.status}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{typeLabel(p.type)}</p>
              </button>
            ))}
            {!pathways.length && <p className="text-sm text-muted-foreground">No pathways yet — create one to get started.</p>}
          </div>

          {/* Editor */}
          <div className="lg:col-span-2 space-y-4">
            <PathwayEditor pathway={selected} members={selectedMembers} competitions={comps} onChanged={() => setRel((n) => n + 1)} onDeleted={() => { setSelId(''); setRel((n) => n + 1); }} />

            {selected?.type === 'series_championship' && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base font-bold">Season standings</h3>
                  <button onClick={recompute} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                    {busy === 'compute' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Compute standings
                  </button>
                </div>
                <div className="mt-4"><PathwayStandings pathway={selected} standings={standings} /></div>
              </div>
            )}

            {(selected?.type === 'state_to_national' || selected?.type === 'local_to_state_to_national') ? (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-heading text-base font-bold">Qualifier promotions</h3>
                    <p className="text-xs text-muted-foreground">Promotes each qualifier's top {selected.promotion_count} into the next tier. Run after a qualifier is closed & audited.</p>
                  </div>
                  <button onClick={promoteAll} disabled={!!busy || !selectedMembers.some((m) => m.promotion_to_challenge_id)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50">
                    {busy === 'promote' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpCircle className="h-4 w-4" />} Promote winners
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function typeLabel(t) {
  const map = { national_state_ranking: 'National + State Rankings', state_to_national: 'State → National', local_to_state_to_national: 'Local → State → National', series_championship: 'Series Championship', private_organisation: 'Private Organisation', invitational: 'Invitational' };
  return map[t] || t;
}