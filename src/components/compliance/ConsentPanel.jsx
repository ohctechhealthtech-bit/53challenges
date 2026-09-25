import { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Loader2, Eye, EyeOff, Gavel, Ban, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';

async function invoke(action, payload = {}) {
  const res = await base44.functions.invoke('guardianConsent', { action, ...payload });
  return res?.data ?? res;
}

const SCOPE_LABELS = {
  scopes_entering_challenge: 'Entering Challenge',
  scopes_terms_acceptance: 'Terms Acceptance',
  scopes_personal_info_processing: 'Personal Info Processing',
  scopes_public_display_name: 'Public Display Name',
  scopes_public_display_age_bracket: 'Public Display Age Bracket',
  scopes_publication_of_entry_media: 'Publication of Entry Media',
  scopes_promotional_reuse: 'Promotional Reuse',
  scopes_direct_communication_with_minor: 'Direct Communication',
  scopes_public_voting_participation: 'Public Voting',
  scopes_prize_acceptance_payment: 'Prize Acceptance/Payment',
  scopes_event_travel_attendance: 'Event/Travel',
  scopes_appears_in_entry: 'Appears in Entry',
};

const MIN_SCOPES = ['scopes_entering_challenge', 'scopes_terms_acceptance', 'scopes_personal_info_processing'];

const STATUS_STYLES = {
  pending: 'bg-amber-500/15 text-amber-400',
  granted: 'bg-emerald-500/15 text-emerald-400',
  declined: 'bg-destructive/15 text-destructive',
  withdrawn: 'bg-purple-500/15 text-purple-400',
};

const METHOD_LABELS = {
  guardian_email_verification: 'Guardian Email Verification',
  guardian_account_countersign: 'Guardian Account Countersign',
  school_bulk_consent: 'School Bulk Consent',
};

export default function ConsentPanel() {
  const [tab, setTab] = useState('requirements');
  const [requirements, setRequirements] = useState([]);
  const [consents, setConsents] = useState([]);
  const [challengeId, setChallengeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [grantingId, setGrantingId] = useState(null);
  const [scopeState, setScopeState] = useState({});
  const [withdrawingId, setWithdrawingId] = useState(null);
  const [newReq, setNewReq] = useState({ name: '', method: 'guardian_email_verification', clause_reference: '' });

  useEffect(() => {
    loadRequirements();
  }, []);

  const loadRequirements = async () => {
    setLoading(true);
    try {
      const { requirements: reqs } = await invoke('list_requirements');
      setRequirements(reqs || []);
    } catch (e) { setError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  const loadConsents = async () => {
    if (!challengeId) return;
    setLoading(true); setError('');
    try {
      const { consents: cs } = await invoke('list_consents', { challenge_id: challengeId });
      setConsents(cs || []);
    } catch (e) { setError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  const createRequirement = async () => {
    if (!newReq.name) return;
    try {
      await invoke('create_requirement', newReq);
      setNewReq({ name: '', method: 'guardian_email_verification', clause_reference: '' });
      await loadRequirements();
    } catch (e) { setError(e?.message || 'Failed to create'); }
  };

  const startGrant = (consent) => {
    setGrantingId(consent.id);
    const initial = {};
    for (const s of Object.keys(SCOPE_LABELS)) initial[s] = consent[s] || false;
    setScopeState(initial);
  };

  const grantConsent = async (consentId) => {
    try {
      await invoke('grant_consent', { consent_id: consentId, scopes: scopeState });
      setGrantingId(null); setScopeState({});
      await loadConsents();
    } catch (e) { setError(e?.message || 'Grant failed'); }
  };

  const withdrawConsent = async (consentId) => {
    try {
      await invoke('withdraw_consent', { consent_id: consentId, reason: 'Withdrawn by admin' });
      setWithdrawingId(null);
      await loadConsents();
    } catch (e) { setError(e?.message || 'Withdrawal failed'); }
  };

  const declineConsent = async (consentId) => {
    try {
      await invoke('decline_consent', { consent_id: consentId });
      await loadConsents();
    } catch (e) { setError(e?.message || 'Decline failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setTab('requirements')}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === 'requirements' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-secondary'}`}>
          Requirements
        </button>
        <button onClick={() => setTab('consents')}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === 'consents' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-secondary'}`}>
          Consent Records
        </button>
      </div>

      {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error}</div>}

      {tab === 'requirements' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 font-heading text-sm font-bold">Create Consent Requirement</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <input placeholder="Requirement name" value={newReq.name} onChange={(e) => setNewReq({ ...newReq, name: e.target.value })} className="c53-input" />
              <select value={newReq.method} onChange={(e) => setNewReq({ ...newReq, method: e.target.value })} className="c53-input">
                {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input placeholder="Clause reference (e.g. ApprovedClause ID)" value={newReq.clause_reference} onChange={(e) => setNewReq({ ...newReq, clause_reference: e.target.value })} className="c53-input" />
            </div>
            <button onClick={createRequirement} disabled={!newReq.name}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              <Plus className="h-4 w-4" /> Add Requirement
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {requirements.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{r.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${r.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                    {r.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{METHOD_LABELS[r.method] || r.method}</p>
                {r.clause_reference && <p className="mt-0.5 text-xs text-muted-foreground">Clause: {r.clause_reference}</p>}
              </div>
            ))}
            {!loading && !requirements.length && (
              <div className="col-span-full py-10 text-center text-sm text-muted-foreground">No requirements yet.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input placeholder="Challenge ID" value={challengeId} onChange={(e) => setChallengeId(e.target.value)} className="c53-input" />
            <button onClick={loadConsents} disabled={loading || !challengeId}
              className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              Load Consents
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
          ) : consents.length > 0 ? (
            <div className="space-y-3">
              {consents.map((c) => (
                <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-semibold">{c.participant_name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">Guardian: {c.guardian_name} ({c.guardian_relationship || 'N/A'})</span>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[c.status] || 'bg-muted'}`}>{c.status}</span>
                  </div>

                  {c.entry_id && <p className="mt-1 text-xs text-muted-foreground">Entry: {c.entry_id}</p>}
                  {c.verified_at && <p className="mt-0.5 text-xs text-muted-foreground">Verified: {new Date(c.verified_at).toLocaleString()}</p>}
                  {c.withdrawn_at && <p className="mt-0.5 text-xs text-destructive">Withdrawn: {new Date(c.withdrawn_at).toLocaleString()}</p>}

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(SCOPE_LABELS).map(([key, label]) => (
                      <span key={key} className={`rounded-full px-2 py-0.5 text-xs ${c[key] ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                        {c[key] ? '✓' : '✗'} {label}
                      </span>
                    ))}
                  </div>

                  {grantingId === c.id && (
                    <div className="mt-3 rounded-lg bg-black/20 p-3">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">Grant scopes:</p>
                      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(SCOPE_LABELS).map(([key, label]) => (
                          <label key={key} className="flex items-center gap-1.5 text-xs">
                            <input type="checkbox" checked={scopeState[key] || false}
                              onChange={(e) => setScopeState({ ...scopeState, [key]: e.target.checked })}
                              className="h-3.5 w-3.5 rounded border-input" />
                            {label}
                            {MIN_SCOPES.includes(key) && <span className="text-primary">*</span>}
                          </label>
                        ))}
                      </div>
                      <p className="mt-1.5 text-xs text-primary">* Minimum required scopes for valid entry</p>
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => grantConsent(c.id)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Confirm Grant</button>
                        <button onClick={() => setGrantingId(null)} className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold">Cancel</button>
                      </div>
                    </div>
                  )}

                  {grantingId !== c.id && c.status === 'pending' && (
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => startGrant(c)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Grant</button>
                      <button onClick={() => declineConsent(c.id)} className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold">Decline</button>
                    </div>
                  )}

                  {grantingId !== c.id && c.status === 'granted' && withdrawingId !== c.id && (
                    <button onClick={() => setWithdrawingId(c.id)} className="mt-2 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white">Withdraw Consent</button>
                  )}

                  {withdrawingId === c.id && (
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => withdrawConsent(c.id)} className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white">Confirm Withdrawal</button>
                      <button onClick={() => setWithdrawingId(null)} className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold">Cancel</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : challengeId ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No consent records found for this challenge.</div>
          ) : null}
        </div>
      )}
    </div>
  );
}