import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import MasterFormDialog from './MasterFormDialog';
import DeleteMasterDialog from './DeleteMasterDialog';
import { TEMPLATE_FIELDS } from './mastersMeta';

// Ready-to-run challenge idea templates shown in the /host-idea wizard.
export default function TemplatesPanel({ templates, onReload }) {
  const [editing, setEditing] = useState(null); // record | 'new'
  const [deleting, setDeleting] = useState(null);

  const save = async (payload) => {
    if (editing === 'new') await adminChallengeApi.mastersTemplateCreate({ template: payload });
    else await adminChallengeApi.mastersTemplateUpdate({ id: editing.id, template: payload });
    onReload();
  };

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-bold">Idea templates</h3>
          <p className="text-sm text-muted-foreground">{templates.length} ready-to-run templates in the host idea wizard.</p>
        </div>
        <Button size="sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add template</Button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3">Template</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Entry type</th>
              <th className="py-2 pr-3">Duration</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Sort</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-b border-border/50">
                <td className="py-2 pr-3 font-medium">{t.template_name}</td>
                <td className="py-2 pr-3">{t.category}</td>
                <td className="py-2 pr-3">{t.entry_type}</td>
                <td className="py-2 pr-3">{t.recommended_duration_weeks ? `${t.recommended_duration_weeks} wks` : '—'}</td>
                <td className="py-2 pr-3 capitalize">{t.status}</td>
                <td className="py-2 pr-3">{t.sort_order}</td>
                <td className="py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(t)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {templates.length === 0 && <tr><td colSpan={7} className="py-4 text-muted-foreground">No idea templates yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <MasterFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add idea template' : `Edit ${editing?.template_name || ''}`}
        fields={TEMPLATE_FIELDS}
        record={editing === 'new' ? null : editing}
        onSave={save}
      />
      <DeleteMasterDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        label={deleting?.template_name}
        onConfirm={async () => { await adminChallengeApi.mastersTemplateDelete({ id: deleting.id }); onReload(); }}
      />
    </section>
  );
}