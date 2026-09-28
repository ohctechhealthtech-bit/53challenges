import { useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldAlert, RefreshCw, Ban, RotateCcw, Filter, BarChart3, Copy, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { detectVoteFraud, logVoteAudit, normalizeEmail } from '@/lib/votes';
import { challengeApi } from '@/lib/challengeApi';

const VOTE_CAP = 5000;

export default function VoteFraudDashboard() {
  const { user } = useAuth();
  // Never fabricate the actor. This read `user?.email || 'admin'`, so a page
  // loaded without a session stamped the literal string "admin" into
  // excluded_by and into the vote audit log — a false name against a decision
  // that removes someone's vote. An empty actor is honest, and the buttons
  // below are disabled without one.
  const admin = user?.email || '';
  const canAct = admin !== '';
  const [challenges, setChallenges] = useState([]);
  const [challengeId, setChallengeId] = useState('');
  const [votes, setVotes] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [lastScan, setLastScan] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const chRes = await challengeApi.listChallenges({ status: 'active', limit: 200 });
      setChallenges(chRes?.challenges || []);
      // 5000 is the entity API's own ceiling (EntityApiController.MAX_LIMIT).
      // This asked for 100,000 and silently received 5000 — a fraud dashboard
      // that quietly hides records is worse than one that says it is looking
      // at a subset, so the cap is named here and reported below.
      const all = challengeId
        ? await base44.entities.Vote.filter({ challenge_id: challengeId }, '-created_date', VOTE_CAP)
        : await base44.entities.Vote.list('-created_date', VOTE_CAP);
      setVotes(all || []);
      setTruncated((all || []).length >= VOTE_CAP);
      const lg = challengeId
        ? await base44.entities.VoteAuditLog.filter({ challenge_id: challengeId }, '-at', 500).catch(() => [])
        : await base44.entities.VoteAuditLog.list('-at', 500).catch(() => []);
      setLog(lg || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [challengeId]);

  const runDetection = async () => {
    setBusy(true);
    try {
      const res = await detectVoteFraud(challengeId || null);
      setLastScan(res);
      await load();
    } finally { setBusy(false); }
  };

  const exclude = async (v, reason) => {
    setBusy(true);
    try {
      await base44.entities.Vote.update(v.id, { excluded: true, excluded_reason: reason, excluded_at: new Date().toISOString(), excluded_by: admin, flag_type: v.flag_type || 'manual' });
      await logVoteAudit({ vote_id: v.id, challenge_id: v.challenge_id, entry_id: v.entry_id, actor: admin, action: 'manual_exclude', reason });
      await load();
    } finally { setBusy(false); }
  };
  const restore = async (v) => {
    setBusy(true);
    try {
      await base44.entities.Vote.update(v.id, { excluded: false, excluded_reason: '', excluded_by: '', flag_type: '' });
      await logVoteAudit({ vote_id: v.id, challenge_id: v.challenge_id, entry_id: v.entry_id, actor: admin, action: 'manual_restore', reason: 'Restored by admin — false flag' });
      await load();
    } finally { setBusy(false); }
  };

  const total = votes.length;
  const excludedVotes = votes.filter((v) => v.excluded);
  const byReason = useMemo(() => {
    const m = {};
    excludedVotes.forEach((v) => { m[v.flag_type || 'manual'] = (m[v.flag_type || 'manual'] || 0) + 1; });
    return m;
  }, [excludedVotes]);

  // duplicate-account groups (per entry, normalised inbox shared by >1 account)
  const dupGroups = useMemo(() => {
    const out = [];
    const byEntry = {};
    votes.forEach((v) => (byEntry[v.entry_id] ||= []).push(v));
    for (const [entryId, evs] of Object.entries(byEntry)) {
      const byNorm = {};
      evs.forEach((v) => (byNorm[normalizeEmail(v.user_email)] ||= []).push(v));
      for (const [k, group] of Object.entries(byNorm)) {
        if (group.length > 1) out.push({ entryId, inbox: k, accounts: group.length, voteIds: group.map((v) => v.id), allExcluded: group.every((x) => x.excluded) });
      }
    }
    return out;
  }, [votes]);

  // vote-spike by hour per entry (top anomalies)
  const spikes = useMemo(() => {
    const out = [];
    const byEntry = {};
    votes.forEach((v) => (byEntry[v.entry_id] ||= []).push(v));
    for (const [entryId, evs] of Object.entries(byEntry)) {
      const hours = {};
      evs.forEach((v) => { const d = new Date(v.created_date); const k = d.toISOString().slice(0, 13); (hours[k] ||= []).push(v); });
      for (const [hk, group] of Object.entries(hours)) {
        if (group.length >= 5 && evs.length > 5 && group.length / evs.length >= 0.4) out.push({ entryId, hour: hk, count: group.length, pct: Math.round((group.length / evs.length) * 100) });
      }
    }
    return out.sort((a, b) => b.count - a.count).slice(0, 20);
  }, [votes]);

  return (
    <div className="container-tight py-12">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-destructive/15 text-destructive"><ShieldAlert className="h-5 w-5" /></span>
        <div>
          <h1 className="font-heading text-3xl font-extrabold">Vote Fraud Dashboard</h1>
          <p className="text-sm text-muted-foreground">Duplicate-account detection, vote-spike anomalies, disqualified votes — flagged votes are excluded from totals with a logged justification.</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Scope</span>
          <select value={challengeId} onChange={(e) => setChallengeId(e.target.value)} className="rounded-xl border border-input bg-white/5 px-3 py-2 text-sm">
            <option value="">All challenges</option>
            {challenges.map((c) => <option key={c.id} value={c.id}>{c.title || c.theme}</option>)}
          </select>
        </label>
        <button onClick={runDetection} disabled={busy || !canAct} className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Run fraud detection
        </button>
      </div>


      {truncated && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Showing the {VOTE_CAP.toLocaleString()} most recent votes — there are more than this.
          Pick a single challenge to narrow the view before drawing conclusions.
        </div>
      )}
      {lastScan && (
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          Scan complete: {lastScan.scanned} votes scanned · {lastScan.flagged} flagged
          ({lastScan.byReason?.duplicate_account || 0} duplicate, {lastScan.byReason?.vote_spike || 0} spike).
        </div>
      )}

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total votes" value={total} icon={BarChart3} />
        <Stat label="Excluded" value={excludedVotes.length} icon={Ban} tone="destructive" />
        <Stat label="Duplicate groups" value={dupGroups.length} icon={Copy} tone="amber" />
        <Stat label="Spike hours" value={spikes.length} icon={Clock} tone="amber" />
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Duplicate accounts */}
          <Section title="Duplicate-account detection" icon={Copy} empty="No duplicate inboxes detected.">
            {dupGroups.map((g) => (
              <div key={g.entryId + g.inbox} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Entry {g.entryId}</span>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${g.allExcluded ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                    {g.accounts} accounts → {g.inbox}{g.allExcluded ? ' · excluded' : ''}
                  </span>
                </div>
              </div>
            ))}
          </Section>

          {/* Vote spikes by hour */}
          <Section title="Vote-spike anomalies by hour" icon={Clock} empty="No hour-window spikes.">
            {spikes.map((s) => (
              <div key={s.entryId + s.hour} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Entry {s.entryId}</span>
                  <span className="text-muted-foreground">{s.hour}h UTC</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full grad-bg" style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-amber-300">{s.count} ({s.pct}%)</span>
                </div>
              </div>
            ))}
          </Section>

          {/* Disqualified votes */}
          <Section title="Disqualified votes" icon={Ban} empty="No disqualified votes." full>
            {excludedVotes.map((v) => (
              <div key={v.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{v.user_email} → entry {v.entry_id}</p>
                    <p className="mt-0.5 text-xs text-amber-300">{v.excluded_reason || '—'} <span className="text-muted-foreground">· by {v.excluded_by || '—'} · {v.flag_type}</span></p>
                  </div>
                  <button onClick={() => restore(v)} disabled={busy || !canAct} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20">
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </button>
                </div>
              </div>
            ))}
          </Section>

          {/* Active votes (manual exclude) */}
          <Section title="Active votes" icon={Filter} empty="No active votes.">
            {votes.filter((v) => !v.excluded).slice(0, 30).map((v) => (
              <div key={v.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{v.user_email} → entry {v.entry_id}</p>
                    <p className="text-xs text-muted-foreground">{new Date(v.created_date).toLocaleString('en-AU')}{v.voter_verified ? ' · verified' : ' · unverified'}</p>
                  </div>
                  <button onClick={() => exclude(v, `Manual exclusion by ${admin}`)} disabled={busy || !canAct} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive hover:bg-destructive/20">
                    <Ban className="h-3.5 w-3.5" /> Exclude
                  </button>
                </div>
              </div>
            ))}
          </Section>

          {/* Audit log */}
          <Section title="Audit log" icon={Clock} empty="No actions logged." full>
            {log.map((l) => (
              <div key={l.id} className="flex justify-between gap-2 border-b border-border/40 py-1.5 text-xs">
                <span><b>{l.action}</b> {l.reason} <span className="text-muted-foreground">· {l.actor}</span></span>
                <span className="shrink-0 text-muted-foreground">{new Date(l.at || l.created_date).toLocaleString('en-AU')}</span>
              </div>
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone = 'primary' }) {
  const tones = { primary: 'bg-primary/15 text-primary', destructive: 'bg-destructive/15 text-destructive', amber: 'bg-amber-500/15 text-amber-300' };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      <div>
        <p className="font-heading text-xl font-extrabold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, empty, full }) {
  return (
    <div className={`rounded-2xl border border-border bg-card/50 p-4 ${full ? 'lg:col-span-2' : ''}`}>
      <h2 className="flex items-center gap-2 font-heading text-base font-bold"><Icon className="h-4 w-4 text-primary" /> {title}</h2>
      <div className="mt-3 space-y-2">
        {!children || (Array.isArray(children) && children.length === 0)
          ? <p className="text-sm text-muted-foreground">{empty}</p>
          : children}
      </div>
    </div>
  );
}