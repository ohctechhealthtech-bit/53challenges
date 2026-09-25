import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Filter, Eye, FileText, Plus, ShieldAlert } from 'lucide-react';
import { corporateIntake } from '@/lib/corporateIntake';
import PublishToMainPanel from '@/components/dashboard/PublishToMainPanel';

const STATUSES = ['intake_received', 'in_review', 'builder_started', 'submitted_for_review', 'approved', 'rejected'];
const SCOPES = ['single', 'series', 'annual_program'];
const FLAGS = ['public_voting', 'minors_involved', 'hybrid', 'enterprise_pipeline', 'account_management', 'community_local_band'];

function fmtDate(s) { return s ? new Date(s).toLocaleDateString() : ''; }

export default function CorporateIntakeQueue() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ review_status: '', service_tier_id: '', account_type_id: '', program_scope: '', compliance_flag: '' });
  const [tiers, setTiers] = useState([]);
  const [accountTypes, setAccountTypes] = useState([]);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, at] = await Promise.all([corporateIntake.listServiceTiers(), corporateIntake.listAccountTypes()]);
      setTiers(t.service_tiers || []);
      setAccountTypes(at.account_types || []);
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const f = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
      const res = await corporateIntake.listResponses(f);
      setRows(res.responses || []);
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (response_id) => {
    setDetailLoading(true);
    try {
      const d = await corporateIntake.getResponseDetail(response_id);
      setDetail(d);
    } catch (e) {
      setDetail({ error: e.message });
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select label="Status" value={filter.review_status} onChange={(v) => setFilter({ ...filter, review_status: v })} options={[['', 'All'], ...STATUSES.map((s) => [s, s])]} />
        <Select label="Tier" value={filter.service_tier_id} onChange={(v) => setFilter({ ...filter, service_tier_id: v })} options={[['', 'All'], ...tiers.map((t) => [t.id, t.name])]} />
        <Select label="Account type" value={filter.account_type_id} onChange={(v) => setFilter({ ...filter, account_type_id: v })} options={[['', 'All'], ...accountTypes.map((t) => [t.id, t.name])]} />
        <Select label="Scope" value={filter.program_scope} onChange={(v) => setFilter({ ...filter, program_scope: v })} options={[['', 'All'], ...SCOPES.map((s) => [s, s])]} />
        <Select label="Flag" value={filter.compliance_flag} onChange={(v) => setFilter({ ...filter, compliance_flag: v })} options={[['', 'All'], ...FLAGS.map((f) => [f, f])]} />
        <Button size="sm" onClick={load}>Apply</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No intake responses yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Organisation</th>
                <th className="p-3">Type</th>
                <th className="p-3">Tier</th>
                <th className="p-3">Scope</th>
                <th className="p-3">Status</th>
                <th className="p-3">Flags</th>
                <th className="p-3">Submitted</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.response_id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 font-medium">{r.host?.name || '—'}</td>
                  <td className="p-3 text-muted-foreground">{accountTypes.find((t) => t.id === r.host?.account_type_id)?.name || '—'}</td>
                  <td className="p-3 text-muted-foreground">{tiers.find((t) => t.id === r.draft?.service_tier_id)?.name || '—'}</td>
                  <td className="p-3 text-muted-foreground">{r.draft?.program_scope || '—'}</td>
                  <td className="p-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{r.draft?.review_status || '—'}</span></td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {(r.draft?.compliance_flags || []).map((f) => (
                        <span key={f} className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400"><ShieldAlert className="h-3 w-3" />{f}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{fmtDate(r.submitted_at)}</td>
                  <td className="p-3"><Button size="sm" variant="ghost" onClick={() => openDetail(r.response_id)}><Eye className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setDetail(null)}>
          <div className="h-full w-full max-w-lg overflow-y-auto bg-background p-6" onClick={(e) => e.stopPropagation()}>
            {detailLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : detail.error ? <p className="text-destructive">{detail.error}</p> : (
              <>
                <h3 className="font-heading text-lg font-bold">{detail.host?.name}</h3>
                <p className="text-sm text-muted-foreground">{detail.host?.abn ? `ABN ${detail.host.abn}` : ''} {detail.host?.state ? `· ${detail.host.state}` : ''}</p>
                <p className="mt-1 text-sm text-muted-foreground">{detail.host?.contacts}</p>

                <div className="mt-4 rounded-lg border border-border bg-card p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Selected answers</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {(detail.selected_options || []).map((o) => (
                      <li key={o.id} className="flex items-start gap-2">
                        <span className="font-medium">{o.label}</span>
                        {o.compliance_flags?.length > 0 && <span className="text-xs text-amber-400">· {o.compliance_flags.join(', ')}</span>}
                      </li>
                    ))}
                  </ul>
                </div>

                {detail.recommendation && (
                  <div className="mt-4 rounded-lg border border-border bg-card p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Recommendation rationale</p>
                    <p className="mt-2 text-sm text-muted-foreground">{detail.recommendation.rationale_summary}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      {['top_mechanics','top_categories','top_modes','top_audiences','top_scoring','top_evidence','top_pathways'].map((k) => (
                        detail.recommendation[k]?.length ? (
                          <div key={k}><span className="text-muted-foreground">{k.replace('top_','')}: </span>{detail.recommendation[k].map((i) => i.name).join(', ')}</div>
                        ) : null
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(detail.recommendation.compliance_flags || []).map((f) => (
                        <span key={f} className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">{f}</span>
                      ))}
                    </div>
                  </div>
                )}

                {detail.draft && (
                  <div className="mt-4 rounded-lg border border-border bg-card p-3 text-sm">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Draft</p>
                    <p className="mt-1">Status: <span className="font-medium">{detail.draft.review_status}</span></p>
                    <p>Scope: <span className="font-medium">{detail.draft.program_scope}</span></p>
                    <p className="mt-2 text-xs text-muted-foreground">Edits to the challenge config are made via the Competition Builder selections — this queue is read-only.</p>
                  </div>
                )}

                {detail.draft && (
                  <PublishToMainPanel
                    draft={detail.draft}
                    hostName={detail.host?.name}
                    onPublished={(cid) => { setDetail({ ...detail, draft: { ...detail.draft, challenge_id: cid, review_status: 'live' } }); load(); }}
                  />
                )}
                <Button className="mt-4" variant="outline" onClick={() => setDetail(null)}>Close</Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="text-xs">
      <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <select className="c53-input min-w-[140px]" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}