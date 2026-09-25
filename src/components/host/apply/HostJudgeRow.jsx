/**
 * One host-nominated judge on the apply wizard. Saving adds them straight to
 * our judge list — no approval step — and keeps their id against this
 * application.
 */
import { useState } from 'react';
import { Loader2, Trash2, Check, LogIn } from 'lucide-react';
import { judgesMaster } from '@/lib/judgesMaster';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export default function HostJudgeRow({ judge, index, options, onChange, onRemove }) {
  const { isAuthenticated } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const disciplines = judge.disciplines || [];
  const ready = (judge.name || '').trim().length > 1 && (judge.email || '').includes('@');

  const set = (k, v) => onChange({ ...judge, [k]: v, id: k === 'email' ? '' : judge.id });
  const toggle = (d) =>
    set('disciplines', disciplines.includes(d) ? disciplines.filter((x) => x !== d) : [...disciplines, d]);

  const save = async () => {
    setError('');
    if (!isAuthenticated) return; // guarded in render — never attempt the API write for guests
    setSaving(true);
    try {
      const res = await judgesMaster.saveHostJudges([judge]);
      const saved = (res.judges || [])[0];
      if (saved?.id) onChange({ ...judge, id: saved.id });
      else setError('We could not add this judge just now.');
    } catch (e) {
      const status = e?.response?.status || e?.status;
      if (status === 401) setError('Please sign in to add judges.');
      else if (status === 403) setError('You do not have permission to add judges.');
      else setError('We could not add this judge just now. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`judge-name-${index}`} className="mb-1 block text-sm font-semibold">Judge name</label>
          <input id={`judge-name-${index}`} className="c53-input" value={judge.name || ''} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label htmlFor={`judge-email-${index}`} className="mb-1 block text-sm font-semibold">Email</label>
          <input id={`judge-email-${index}`} type="email" className="c53-input" value={judge.email || ''} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div>
          <label htmlFor={`judge-level-${index}`} className="mb-1 block text-sm font-semibold">Judging level</label>
          <select id={`judge-level-${index}`} className="c53-input" value={judge.level || 'state'} onChange={(e) => set('level', e.target.value)}>
            {(options?.levels || ['state', 'national', 'overall']).map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-semibold">
            What can they judge? <span className="font-normal text-muted-foreground">(optional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {(options?.categories || []).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggle(d)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${disciplines.includes(d) ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}
              >
                {d.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {judge.id ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
            <Check className="h-4 w-4" /> Added to your panel
          </span>
        ) : !isAuthenticated ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Please sign in to add judges</span>
            <button
              type="button"
              onClick={() => base44.auth.redirectToLogin(window.location.pathname)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <LogIn className="h-4 w-4" /> Sign in
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={save}
            disabled={!ready || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Add this judge
          </button>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} className="inline-flex items-center gap-1.5 text-sm font-semibold text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}