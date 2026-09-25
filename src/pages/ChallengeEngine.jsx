import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';
import { challengeEngine, STATUS_LABELS } from '@/lib/challengeEngine';
import ChallengeList from '@/components/engine/ChallengeList';
import ChallengeDraftForm from '@/components/engine/ChallengeDraftForm';
import EntryModerationPanel from '@/components/engine/EntryModerationPanel';
import TemplateLibraryPanel from '@/components/templates/TemplateLibraryPanel';

export default function ChallengeEngine() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('view'); // view | create
  const [tab, setTab] = useState('challenges'); // challenges | templates
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = async (keepId) => {
    setLoading(true);
    try {
      const res = await challengeEngine.list();
      const list = res.challenges || [];
      setChallenges(list);
      const id = keepId || selected?.id;
      setSelected(id ? list.find((c) => String(c.id) === String(id)) || null : null);
    } catch (e) {
      setError(e.message || 'Failed to load challenges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await challengeEngine.create(data);
      setMode('view');
      await load(res.challenge?.id);
    } catch (e) {
      setError(e.message || 'Failed to create challenge');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-tight py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-extrabold">Challenge Engine</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Challenges are created in and read from the main app's Challenge API.
          </p>
        </div>
        {tab === 'challenges' && (
          <Button onClick={() => { setSelected(null); setMode('create'); }}>
            <Plus className="mr-1 h-4 w-4" /> New challenge
          </Button>
        )}
      </div>

      <div className="mt-5 flex gap-2 border-b border-border">
        {[['challenges', 'Challenges'], ['templates', 'Template Library']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold transition ${tab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</div>}

      {tab === 'templates' && <div className="mt-6"><TemplateLibraryPanel /></div>}

      <div className={`mt-6 grid gap-6 lg:grid-cols-[320px_1fr] ${tab === 'templates' ? 'hidden' : ''}`}>
        <div>
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <ChallengeList challenges={challenges} selectedId={selected?.id} onSelect={(c) => { setSelected(c); setMode('view'); }} />
          )}
        </div>

        <div>
          {mode === 'create' ? (
            <ChallengeDraftForm onSubmit={handleCreate} onCancel={() => setMode('view')} submitting={submitting} />
          ) : selected ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="font-heading text-lg font-bold">{selected.title || selected.theme}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selected.brief || selected.description}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Status: <span className="font-semibold text-foreground">{STATUS_LABELS[selected.status] || selected.status}</span>
                  {selected.start_date ? ` · ${selected.start_date} → ${selected.end_date || ''}` : ''}
                </p>
              </div>
              <EntryModerationPanel challengeId={selected.id} />
            </div>
          ) : (
            <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Select a challenge to view its details, or create a new one.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}