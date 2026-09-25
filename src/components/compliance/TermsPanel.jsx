import { useState } from 'react';
import {
  FileText, Plus, Stamp, Loader2, AlertTriangle, CheckCircle2,
  Eye, Upload, X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

async function invoke(action, payload = {}) {
  return base44.functions.invoke('termsAssembler', { action, ...payload });
}

const CATEGORY_LABELS = {
  promoter_identity: 'Promoter Identity', eligibility: 'Eligibility',
  entry_method: 'Entry Method', free_entry_route: 'Free Entry Route',
  judging: 'Judging', voting: 'Voting', draw_procedure: 'Draw Procedure',
  prizes: 'Prizes', permit_statements: 'Permit Statements',
  privacy: 'Privacy', rights_grants: 'Rights Grants', minors: 'Minors',
  disputes: 'Disputes', liability: 'Liability', general: 'General',
};

const STATUS_STYLES = {
  draft: 'bg-amber-500/15 text-amber-400',
  reviewed: 'bg-blue-500/15 text-blue-400',
  published: 'bg-emerald-500/15 text-emerald-400',
  superseded: 'bg-muted text-muted-foreground',
};

export default function TermsPanel() {
  const [tab, setTab] = useState('clauses'); // 'clauses' | 'assemble'
  const [clauses, setClauses] = useState([]);
  const [loadingClauses, setLoadingClauses] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [signing, setSigning] = useState(null);
  const [signForm, setSignForm] = useState({ reviewer: '', date: '', reference: '' });

  // Assemble state
  const [challengeId, setChallengeId] = useState('');
  const [factsJson, setFactsJson] = useState('');
  const [assembling, setAssembling] = useState(false);
  const [assembleResult, setAssembleResult] = useState(null);
  const [assembleErrors, setAssembleErrors] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [publishing, setPublishing] = useState(null);

  const loadClauses = async () => {
    setLoadingClauses(true);
    try {
      const res = await invoke('list_clauses');
      setClauses(res?.data?.clauses ?? res?.clauses ?? []);
    } catch { /* non-fatal */ } finally { setLoadingClauses(false); }
  };

  const loadDocuments = async (cid) => {
    try {
      const res = await invoke('list_documents', { challenge_id: cid });
      setDocuments(res?.data?.documents ?? res?.documents ?? []);
    } catch { /* non-fatal */ }
  };

  const handleAssemble = async () => {
    if (!challengeId) return;
    setAssembling(true); setAssembleErrors([]); setAssembleResult(null);
    try {
      let factsOverride = {};
      if (factsJson.trim()) {
        try { factsOverride = JSON.parse(factsJson); }
        catch { setAssembleErrors([{ stop: 'invalid_json', detail: 'Invalid facts override JSON' }]); setAssembling(false); return; }
      }
      const res = await invoke('assemble', { challenge_id: challengeId, facts_override: factsOverride });
      const data = res?.data ?? res;
      if (data?.errors?.length) {
        setAssembleErrors(data.errors);
      } else if (data?.result) {
        setAssembleResult(data.result);
        await loadDocuments(challengeId);
      } else if (data?.error) {
        setAssembleErrors([{ stop: 'api_error', detail: data.error }]);
      }
    } catch (e) {
      const msg = e?.message || 'Assembly failed';
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.errors) setAssembleErrors(parsed.errors);
        else setAssembleErrors([{ stop: 'api_error', detail: msg }]);
      } catch {
        setAssembleErrors([{ stop: 'api_error', detail: msg }]);
      }
    } finally { setAssembling(false); }
  };

  const handlePublish = async (docId) => {
    setPublishing(docId);
    try {
      await invoke('publish_document', { document_id: docId });
      await loadDocuments(challengeId);
    } catch { /* non-fatal */ } finally { setPublishing(null); }
  };

  const handleSign = async (clauseId) => {
    if (!signForm.reviewer || !signForm.date || !signForm.reference) return;
    try {
      await invoke('sign_clause', { clause_id: clauseId, ...signForm });
      setSigning(null); setSignForm({ reviewer: '', date: '', reference: '' });
      await loadClauses();
    } catch { /* non-fatal */ }
  };

  // Load clauses on mount
  useState(() => { loadClauses(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setTab('clauses')}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === 'clauses' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
          Clause Library
        </button>
        <button onClick={() => setTab('assemble')}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === 'assemble' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
          Assemble & Publish
        </button>
      </div>

      {tab === 'clauses' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-sm font-bold">Approved Clauses ({clauses.length})</h3>
            <button onClick={() => setShowCreate(!showCreate)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">
              <Plus className="h-4 w-4" /> New Clause
            </button>
          </div>

          {showCreate && <CreateClauseForm onCreated={() => { setShowCreate(false); loadClauses(); }} />}

          {loadingClauses ? (
            <div className="py-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
          ) : clauses.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No clauses yet. Create one to get started.</div>
          ) : (
            <div className="space-y-2">
              {clauses.map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-bold text-primary">{c.identifier}</code>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{CATEGORY_LABELS[c.category] || c.category}</span>
                      {c.mandatory && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">mandatory</span>}
                      {c.signed ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">signed</span>
                      ) : (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">unsigned</span>
                      )}
                      {c.expired && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">expired</span>}
                    </div>
                    {!c.signed && (
                      <button onClick={() => setSigning(signing === c.id ? null : c.id)}
                        className="rounded-lg bg-secondary px-3 py-1 text-xs font-semibold text-foreground">Sign</button>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-semibold">{c.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{c.body?.substring(0, 150)}...</p>
                  {c.required_variables?.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">Variables: {c.required_variables.join(', ')}</p>
                  )}
                  {signing === c.id && (
                    <div className="mt-2 space-y-2 rounded-lg bg-black/20 p-3">
                      <input placeholder="Reviewer name" value={signForm.reviewer} onChange={(e) => setSignForm({ ...signForm, reviewer: e.target.value })} className="c53-input" />
                      <input placeholder="Date (YYYY-MM-DD)" value={signForm.date} onChange={(e) => setSignForm({ ...signForm, date: e.target.value })} className="c53-input" />
                      <input placeholder="Reference" value={signForm.reference} onChange={(e) => setSignForm({ ...signForm, reference: e.target.value })} className="c53-input" />
                      <button onClick={() => handleSign(c.id)} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Confirm Sign</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'assemble' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 font-heading text-sm font-bold">Assemble Terms Document</h3>
            <input placeholder="Challenge ID" value={challengeId} onChange={(e) => setChallengeId(e.target.value)} className="c53-input" />
            <textarea
              placeholder='Optional facts override JSON, e.g. {"total_prize_pool": 5000}'
              value={factsJson} onChange={(e) => setFactsJson(e.target.value)}
              className="c53-input mt-2" rows={3}
            />
            <button onClick={handleAssemble} disabled={assembling || !challengeId}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {assembling ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Assemble Terms
            </button>
            {challengeId && (
              <button onClick={() => loadDocuments(challengeId)} className="ml-2 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-foreground">Refresh Documents</button>
            )}
          </div>

          {assembleErrors.length > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-destructive"><AlertTriangle className="h-4 w-4" /> Assembly STOPPED — Legal Review Required</div>
              {assembleErrors.map((e, i) => (
                <div key={i} className="mt-1 rounded-lg bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  <span className="font-bold uppercase">{e.stop}</span>: {e.detail}
                </div>
              ))}
            </div>
          )}

          {assembleResult && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Terms Document Assembled</div>
              <p className="text-xs text-muted-foreground">{assembleResult.clauses_used} clauses used. Classification: {assembleResult.classification}</p>
              {assembleResult.clauses?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {assembleResult.clauses.map((c) => (
                    <span key={c.id} className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{c.identifier}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {documents.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 font-heading text-sm font-bold">Terms Documents ({documents.length})</h3>
              <div className="space-y-2">
                {documents.map((d) => (
                  <div key={d.id} className="rounded-lg bg-black/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[d.status] || 'bg-muted'}`}>{d.status}</span>
                        <span className="text-xs text-muted-foreground">{d.clause_versions_used?.length || 0} clauses</span>
                        {d.published_at && <span className="text-xs text-muted-foreground">Published: {new Date(d.published_at).toLocaleDateString()}</span>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={async () => { const res = await invoke('get_document', { document_id: d.id }); setViewingDoc(res?.data?.document ?? res?.document ?? d); }}
                          className="rounded-lg bg-secondary px-2 py-1 text-xs font-semibold text-foreground"><Eye className="h-3 w-3" /></button>
                        {['draft', 'reviewed'].includes(d.status) && (
                          <button onClick={() => handlePublish(d.id)} disabled={publishing === d.id}
                            className="rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                            {publishing === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Publish
                          </button>
                        )}
                      </div>
                    </div>
                    {d.change_note && <p className="mt-1 text-xs text-muted-foreground">{d.change_note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewingDoc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setViewingDoc(null)}>
              <div className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-heading text-lg font-bold">Terms Document</h3>
                  <button onClick={() => setViewingDoc(null)} className="rounded-lg bg-muted p-1.5"><X className="h-4 w-4" /></button>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{viewingDoc.merged_output}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CreateClauseForm({ onCreated }) {
  const [form, setForm] = useState({
    identifier: '', title: '', body: '', category: 'general',
    mandatory: true, required_variables: '', prohibited_combinations: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!form.identifier || !form.title || !form.body) { setError('identifier, title, body required'); return; }
    setSaving(true); setError('');
    try {
      await invoke('create_clause', {
        identifier: form.identifier,
        title: form.title,
        body: form.body,
        category: form.category,
        mandatory: form.mandatory,
        required_variables: form.required_variables ? form.required_variables.split(',').map(s => s.trim()) : [],
        prohibited_combinations: form.prohibited_combinations ? form.prohibited_combinations.split(',').map(s => s.trim()) : [],
      });
      onCreated();
    } catch (e) { setError(e?.message || 'Create failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <h4 className="font-heading text-sm font-bold">New Clause</h4>
      <input placeholder="Identifier (e.g. promoter_identity_001)" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} className="c53-input" />
      <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="c53-input" />
      <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="c53-input">
        {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <textarea placeholder="Clause body (use {{variable_name}} for merge variables)" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="c53-input" rows={5} />
      <input placeholder="Required variables (comma-separated)" value={form.required_variables} onChange={(e) => setForm({ ...form, required_variables: e.target.value })} className="c53-input" />
      <input placeholder="Prohibited combinations (comma-separated identifiers)" value={form.prohibited_combinations} onChange={(e) => setForm({ ...form, prohibited_combinations: e.target.value })} className="c53-input" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.mandatory} onChange={(e) => setForm({ ...form, mandatory: e.target.checked })} /> Mandatory clause</label>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button onClick={handleCreate} disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />} Create Clause
      </button>
    </div>
  );
}