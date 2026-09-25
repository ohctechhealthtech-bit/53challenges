/**
 * Judges master panel — list, add, edit and activate judges.
 * All data comes from the external judges API; nothing is stored in this app.
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Plus } from 'lucide-react';
import { judgesMaster } from '@/lib/judgesMaster';
import JudgeMasterTable from '@/components/judges/JudgeMasterTable';
import JudgeMasterForm from '@/components/judges/JudgeMasterForm';
import { Button } from '@/components/ui/button';

export default function JudgesMasterPanel() {
  const [options, setOptions] = useState(null);
  const [judges, setJudges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ active: '', level: '', discipline: '' });
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busyEmail, setBusyEmail] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.active) params.active = filters.active;
      if (filters.level) params.level = filters.level;
      if (filters.discipline) params.discipline = filters.discipline;
      const res = await judgesMaster.list(params);
      setJudges(res.judges || []);
    } catch (e) {
      setError(e.message || 'Could not load the judges master.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { judgesMaster.options().then(setOptions).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (judge) => {
    await judgesMaster.upsert(judge);
    setShowForm(false);
    setEditing(null);
    await load();
  };

  const toggleActive = async (j) => {
    setBusyEmail(j.email);
    try {
      await judgesMaster.setActive(j.email, !j.active);
      await load();
    } finally {
      setBusyEmail('');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          The single list of judges used across challenges and host requests.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          <Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus className="mr-2 h-4 w-4" /> Add judge</Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="f-active" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</label>
          <select id="f-active" className="c53-input" value={filters.active} onChange={(e) => setFilters((f) => ({ ...f, active: e.target.value }))}>
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-level" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Level</label>
          <select id="f-level" className="c53-input" value={filters.level} onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))}>
            <option value="">All levels</option>
            {(options?.levels || []).map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-disc" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Discipline</label>
          <select id="f-disc" className="c53-input" value={filters.discipline} onChange={(e) => setFilters((f) => ({ ...f, discipline: e.target.value }))}>
            <option value="">All disciplines</option>
            {(options?.categories || []).map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      {(showForm || editing) && (
        <div className="mt-6">
          <JudgeMasterForm
            judge={editing}
            options={options}
            onSave={save}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : error ? (
          <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>
        ) : (
          <JudgeMasterTable
            judges={judges}
            busyEmail={busyEmail}
            onEdit={(j) => { setEditing(j); setShowForm(false); }}
            onToggleActive={toggleActive}
          />
        )}
      </div>
    </div>
  );
}