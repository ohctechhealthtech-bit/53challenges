import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';
import { templateLibrary } from '@/lib/templateLibrary';
import TemplateList from './TemplateList';
import TemplateDetail from './TemplateDetail';
import TemplateWizard from './TemplateWizard';

export default function TemplateLibraryPanel() {
  const [templates, setTemplates] = useState([]);
  const [versions, setVersions] = useState([]);
  const [filters, setFilters] = useState({ sort: 'modified' });
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = async (keepId) => {
    setLoading(true);
    try {
      const data = await templateLibrary.list(filters);
      setTemplates(data.templates || []);
      const id = keepId || selected?.id;
      const next = id ? (data.templates || []).find((t) => String(t.id) === String(id)) : null;
      setSelected(next || null);
      if (next) {
        const v = await templateLibrary.versions(next.template_family_id);
        setVersions(v.versions || []);
      } else {
        setVersions([]);
      }
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [JSON.stringify(filters)]);

  const select = async (t) => {
    setSelected(t);
    setEditing(null);
    setErrors(null);
    const v = await templateLibrary.versions(t.template_family_id);
    setVersions(v.versions || []);
  };

  const run = async (fn) => {
    setBusy(true);
    setMessage('');
    try { return await fn(); }
    catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };

  const createTemplate = () => run(async () => {
    const { template } = await templateLibrary.create();
    setEditing(template);
    setErrors(null);
    await load(template.id);
  });

  const save = (draft) => run(async () => {
    const { template } = await templateLibrary.save(draft.id, draft);
    setEditing(template);
    await load(template.id);
  });

  const publish = (draft) => run(async () => {
    try {
      const res = await templateLibrary.publish(draft.id);
      setErrors([]);
      setEditing(null);
      setMessage(res.repair_warning || 'Template published and now available to hosts.');
      await load(draft.id);
    } catch (e) {
      const data = await templateLibrary.validate(draft.id);
      setErrors(data.errors?.length ? data.errors : [e.message]);
    }
  });

  const newVersion = (t) => run(async () => {
    const { template } = await templateLibrary.newVersion(t.id);
    setEditing(template);
    setErrors(null);
    await load(template.id);
  });

  const archive = (t, reason) => run(async () => {
    await templateLibrary.archive(t.id, reason);
    setMessage('Template archived.');
    await load(t.id);
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Master challenge packages. Hosts choose from active templates — Concept and Rules stay locked.
        </p>
        <Button onClick={createTemplate} disabled={busy}><Plus className="mr-1 h-4 w-4" /> New template</Button>
      </div>

      {message && <div className="mt-4 rounded-lg border border-border bg-white/5 px-3 py-2 text-sm" role="status">{message}</div>}

      <div className="mt-5 grid gap-6 lg:grid-cols-[340px_1fr]">
        <div>
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <TemplateList templates={templates} filters={filters} onFilters={setFilters} selectedId={selected?.id} onSelect={select} />
          )}
        </div>
        <div>
          {editing ? (
            <TemplateWizard
              key={editing.id}
              template={editing}
              onSave={save}
              onPublish={publish}
              onCancel={() => { setEditing(null); setErrors(null); }}
              busy={busy}
              errors={errors}
            />
          ) : selected ? (
            <TemplateDetail
              template={selected}
              versions={versions}
              onEditDraft={(t) => { setEditing(t); setErrors(null); }}
              onNewVersion={newVersion}
              onArchive={archive}
              busy={busy}
            />
          ) : (
            <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Select a template to review it, or create a new one.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}