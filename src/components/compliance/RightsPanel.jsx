import { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Loader2, Music, Users, Megaphone, FileText, CheckCircle2, XCircle, Ban, Eye } from 'lucide-react';
import { base44 } from '@/api/base44Client';

async function invoke(action, payload = {}) {
  const res = await base44.functions.invoke('rightsManager', { action, ...payload });
  return res?.data ?? res;
}

const TIER_LABELS = {
  tier1_mandatory: 'Tier 1 — Mandatory',
  tier2_standard: 'Tier 2 — Standard',
  tier3_extended: 'Tier 3 — Extended',
  marketing_contact: 'Marketing Contact',
};

const TIER_STYLES = {
  tier1_mandatory: 'bg-red-500/15 text-red-400',
  tier2_standard: 'bg-blue-500/15 text-blue-400',
  tier3_extended: 'bg-purple-500/15 text-purple-400',
  marketing_contact: 'bg-amber-500/15 text-amber-400',
};

const MUSIC_POLICY_LABELS = {
  original_or_licensed_only: 'Original or Licensed Only',
  platform_supplied_tracks: 'Platform Supplied Tracks',
  commercial_music_display_only: 'Commercial Music (Display Only)',
};

const THIRD_PARTY_LABELS = {
  none_permitted: 'None Permitted',
  release_required: 'Release Required',
  incidental_ok_for_display: 'Incidental OK for Display',
};

const SCOPE_GRANT_STATUS = {
  granted: 'bg-emerald-500/15 text-emerald-400',
  declined: 'bg-destructive/15 text-destructive',
};

export default function RightsPanel() {
  const [tab, setTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [useLogs, setUseLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Config form
  const [configChallengeId, setConfigChallengeId] = useState('');
  const [config, setConfig] = useState(null);
  const [musicPolicy, setMusicPolicy] = useState('original_or_licensed_only');
  const [thirdPartyPolicy, setThirdPartyPolicy] = useState('none_permitted');
  const [sponsorUsePeriod, setSponsorUsePeriod] = useState('');

  // Use gate
  const [useEntryId, setUseEntryId] = useState('');
  const [useScopes, setUseScopes] = useState('');
  const [useChannel, setUseChannel] = useState('');
  const [useDescription, setUseDescription] = useState('');
  const [useResult, setUseResult] = useState(null);
  const [effectiveScopes, setEffectiveScopes] = useState(null);
  const [effEntryId, setEffEntryId] = useState('');

  // Template signing
  const [signingId, setSigningId] = useState(null);
  const [signForm, setSignForm] = useState({ reviewer: '', date: '', reference: '' });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true); setError('');
    try {
      const [t, c, l] = await Promise.all([
        invoke('list_templates'),
        invoke('list_configs'),
        invoke('list_use_logs'),
      ]);
      setTemplates(t.templates || []);
      setConfigs(c.configs || []);
      setUseLogs(l.logs || []);
    } catch (e) { setError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  const loadConfig = async () => {
    if (!configChallengeId) return;
    setLoading(true); setError('');
    try {
      const { config: c } = await invoke('get_config', { challenge_id: configChallengeId });
      setConfig(c);
      if (c) {
        setMusicPolicy(c.music_policy || 'original_or_licensed_only');
        setThirdPartyPolicy(c.third_party_policy || 'none_permitted');
        setSponsorUsePeriod(c.sponsor_use_period || '');
      }
    } catch (e) { setError(e?.message || 'Failed to load config'); }
    finally { setLoading(false); }
  };

  const saveConfig = async () => {
    if (!configChallengeId) return;
    setLoading(true); setError('');
    try {
      const includedScopes = (templates || []).map((t) => ({
        scope_code: t.scope_code,
        template_id: t.id,
        tier: t.tier,
        clause_version_id: t.clause_reference,
        marking: t.tier === 'tier1_mandatory' ? 'mandatory' :
                 t.tier === 'tier2_standard' ? 'default_on' :
                 t.tier === 'tier3_extended' ? 'opt_in' : 'opt_in',
      }));
      await invoke('save_config', {
        challenge_id: configChallengeId,
        included_scope_versions: includedScopes,
        music_policy: musicPolicy,
        third_party_policy: thirdPartyPolicy,
        sponsor_use_period: sponsorUsePeriod,
        marketing_contact_senders: ['platform53', 'host_organisation'],
      });
      await loadConfig();
      await loadAll();
    } catch (e) { setError(e?.message || 'Failed to save'); }
    finally { setLoading(false); }
  };

  const signTemplate = async (templateId) => {
    setLoading(true); setError('');
    try {
      await invoke('sign_template', { template_id: templateId, ...signForm });
      setSigningId(null);
      setSignForm({ reviewer: '', date: '', reference: '' });
      await loadAll();
    } catch (e) { setError(e?.message || 'Failed to sign'); }
    finally { setLoading(false); }
  };

  const checkUse = async () => {
    if (!useEntryId || !useScopes) return;
    setLoading(true); setError(''); setUseResult(null);
    try {
      const scopes = useScopes.split(',').map((s) => s.trim()).filter(Boolean);
      const result = await invoke('check_use', { entry_id: useEntryId, requested_scopes: scopes });
      setUseResult(result);
    } catch (e) { setError(e?.message || 'Check failed'); }
    finally { setLoading(false); }
  };

  const logUse = async () => {
    if (!useEntryId || !useScopes) return;
    setLoading(true); setError('');
    try {
      const scopes = useScopes.split(',').map((s) => s.trim()).filter(Boolean);
      const result = await invoke('log_use', {
        challenge_id: configChallengeId || 'test_challenge',
        entry_id: useEntryId,
        used_by: 'platform',
        channel: useChannel,
        description: useDescription,
        scopes_relied_on: scopes,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setUseResult({ cleared: true, logged: true, log: result.log });
        await loadAll();
      }
    } catch (e) { setError(e?.message || 'Log failed'); }
    finally { setLoading(false); }
  };

  const getEffective = async () => {
    if (!effEntryId) return;
    setLoading(true); setError(''); setEffectiveScopes(null);
    try {
      const result = await invoke('get_effective_scopes', { entry_id: effEntryId });
      setEffectiveScopes(result);
    } catch (e) { setError(e?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const revokeScope = async (entryId, scope) => {
    setLoading(true); setError('');
    try {
      await invoke('revoke_scope', { entry_id: entryId, scope_code: scope });
      await loadAll();
    } catch (e) { setError(e?.message || 'Revoke failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'templates', label: 'Templates', icon: FileText },
          { id: 'config', label: 'Challenge Config', icon: ShieldCheck },
          { id: 'use_gate', label: 'Marketing Use Gate', icon: Megaphone },
          { id: 'effective', label: 'Effective Scopes', icon: Eye },
          { id: 'logs', label: 'Use Logs', icon: Users },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === t.id ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-secondary'}`}>
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error}</div>}

      {loading ? (
        <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
      ) : tab === 'templates' ? (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <code className="text-xs font-bold text-primary">{t.scope_code}</code>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TIER_STYLES[t.tier] || 'bg-muted'}`}>{TIER_LABELS[t.tier] || t.tier}</span>
                </div>
                <div className="flex items-center gap-2">
                  {t.legal_signoff?.reviewer ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">✓ Signed</span>
                  ) : (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">Draft (unsigned)</span>
                  )}
                </div>
              </div>
              <p className="mt-1 text-sm font-semibold">{t.display_name}</p>
              {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
              <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Duration: {t.default_duration}</span>
                <span>Territory: {t.default_territory}</span>
                <span>Sublicensable: {t.default_sublicensable ? 'Yes' : 'No'}</span>
                <span>Revocable: {t.default_revocable ? 'Yes' : 'No'}</span>
              </div>

              {signingId === t.id && (
                <div className="mt-3 rounded-lg bg-black/20 p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Legal sign-off:</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input placeholder="Reviewer" value={signForm.reviewer} onChange={(e) => setSignForm({ ...signForm, reviewer: e.target.value })} className="c53-input" />
                    <input type="date" value={signForm.date} onChange={(e) => setSignForm({ ...signForm, date: e.target.value })} className="c53-input" />
                    <input placeholder="Reference" value={signForm.reference} onChange={(e) => setSignForm({ ...signForm, reference: e.target.value })} className="c53-input" />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => signTemplate(t.id)} disabled={!signForm.reviewer || !signForm.date || !signForm.reference}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Confirm Sign</button>
                    <button onClick={() => setSigningId(null)} className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold">Cancel</button>
                  </div>
                </div>
              )}

              {signingId !== t.id && !t.legal_signoff?.reviewer && (
                <button onClick={() => setSigningId(t.id)} className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Sign Off</button>
              )}
            </div>
          ))}
        </div>
      ) : tab === 'config' ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input placeholder="Challenge ID" value={configChallengeId} onChange={(e) => setConfigChallengeId(e.target.value)} className="c53-input" />
            <button onClick={loadConfig} disabled={!configChallengeId} className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Load</button>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="font-heading text-sm font-bold">Rights Configuration</h3>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Music Policy</label>
              <select value={musicPolicy} onChange={(e) => setMusicPolicy(e.target.value)} className="c53-input">
                {Object.entries(MUSIC_POLICY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Third-Party Policy</label>
              <select value={thirdPartyPolicy} onChange={(e) => setThirdPartyPolicy(e.target.value)} className="c53-input">
                {Object.entries(THIRD_PARTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Sponsor Use Period</label>
              <input placeholder="e.g. 6_months" value={sponsorUsePeriod} onChange={(e) => setSponsorUsePeriod(e.target.value)} className="c53-input" />
            </div>
            <button onClick={saveConfig} disabled={!configChallengeId} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save Configuration</button>
          </div>

          {configs.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-heading text-sm font-bold">Saved Configurations</h3>
              {configs.map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                  <code className="text-xs text-primary">{c.challenge_id}</code>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Music: {MUSIC_POLICY_LABELS[c.music_policy] || c.music_policy}</span>
                    <span>Third-party: {THIRD_PARTY_LABELS[c.third_party_policy] || c.third_party_policy}</span>
                    <span>Scopes: {(c.included_scope_versions || []).length}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : tab === 'use_gate' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="font-heading text-sm font-bold">Marketing Use Gate</h3>
            <p className="text-xs text-muted-foreground">Staff/host select entry + intended use; system returns effective scopes and blocks a use not cleared. Every cleared use writes a MarketingUseLog.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input placeholder="Entry ID" value={useEntryId} onChange={(e) => setUseEntryId(e.target.value)} className="c53-input" />
              <input placeholder="Requested scopes (comma-separated)" value={useScopes} onChange={(e) => setUseScopes(e.target.value)} className="c53-input" />
              <input placeholder="Channel (e.g. instagram)" value={useChannel} onChange={(e) => setUseChannel(e.target.value)} className="c53-input" />
              <input placeholder="Description" value={useDescription} onChange={(e) => setUseDescription(e.target.value)} className="c53-input" />
            </div>
            <div className="flex gap-2">
              <button onClick={checkUse} disabled={!useEntryId || !useScopes} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Check Use</button>
              <button onClick={logUse} disabled={!useEntryId || !useScopes} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Log Cleared Use</button>
            </div>
          </div>

          {useResult && (
            <div className={`rounded-xl border p-4 ${useResult.cleared ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
              <div className="flex items-center gap-2">
                {useResult.cleared ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-destructive" />}
                <span className="font-semibold">{useResult.cleared ? 'Use Cleared' : 'Use Blocked'}</span>
              </div>
              {useResult.missing?.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Missing scopes: {useResult.missing.join(', ')}</p>
              )}
              {useResult.blocked?.length > 0 && (
                <p className="mt-1 text-xs text-destructive">Blocked scopes: {useResult.blocked.join(', ')}</p>
              )}
              {useResult.effective_scopes?.length > 0 && (
                <p className="mt-1 text-xs text-emerald-400">Effective scopes: {useResult.effective_scopes.join(', ')}</p>
              )}
              {useResult.log && (
                <p className="mt-2 text-xs text-emerald-400">✓ MarketingUseLog created: {useResult.log.id}</p>
              )}
            </div>
          )}
        </div>
      ) : tab === 'effective' ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input placeholder="Entry ID" value={effEntryId} onChange={(e) => setEffEntryId(e.target.value)} className="c53-input" />
            <button onClick={getEffective} disabled={!effEntryId} className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Get Effective Scopes</button>
          </div>
          {effectiveScopes && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div>
                <span className="text-xs font-semibold text-emerald-400">Effective (granted ∩ configured − blocked):</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {effectiveScopes.effective?.length ? effectiveScopes.effective.map((s) => (
                    <span key={s} className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">{s}</span>
                  )) : <span className="text-xs text-muted-foreground">None</span>}
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold text-blue-400">Granted:</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {effectiveScopes.granted?.length ? effectiveScopes.granted.map((s) => (
                    <span key={s} className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-blue-400">{s}</span>
                  )) : <span className="text-xs text-muted-foreground">None</span>}
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold text-destructive">Blocked:</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {effectiveScopes.blocked?.length ? effectiveScopes.blocked.map((s) => (
                    <span key={s} className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">{s}</span>
                  )) : <span className="text-xs text-muted-foreground">None</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {useLogs.length > 0 ? useLogs.map((l) => (
            <div key={l.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{l.used_by === 'platform' ? 'Platform' : 'Host'}</span>
                  <span className="text-xs text-muted-foreground">{l.channel || 'no channel'}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${l.takedown_status === 'not_required' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                  {l.takedown_status === 'not_required' ? 'Active' : `Takedown: ${l.takedown_status}`}
                </span>
              </div>
              {l.description && <p className="mt-1 text-xs text-muted-foreground">{l.description}</p>}
              {l.entry_id && <p className="mt-0.5 text-xs text-muted-foreground">Entry: {l.entry_id}</p>}
              {l.scopes_relied_on?.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {l.scopes_relied_on.map((s) => (
                    <span key={s} className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-blue-400">{s}</span>
                  ))}
                </div>
              )}
              {l.used_at && <p className="mt-1 text-xs text-muted-foreground">{new Date(l.used_at).toLocaleString()}</p>}
              {l.takedown_status === 'pending' && l.entry_id && (
                <button onClick={() => revokeScope(l.entry_id, l.scopes_relied_on?.[0])}
                  className="mt-2 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white">
                  Revoke Scope & Takedown
                </button>
              )}
            </div>
          )) : (
            <div className="py-10 text-center text-sm text-muted-foreground">No marketing use logs yet.</div>
          )}
        </div>
      )}
    </div>
  );
}