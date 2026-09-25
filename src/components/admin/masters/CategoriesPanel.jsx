import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import MasterFormDialog from './MasterFormDialog';
import DeleteMasterDialog from './DeleteMasterDialog';
import { CATEGORY_FIELDS } from './mastersMeta';

// Challenge category master list — create, edit and delete.
export default function CategoriesPanel({ categories, onReload }) {
  const [editing, setEditing] = useState(null); // record | 'new'
  const [deleting, setDeleting] = useState(null);

  const save = async (payload) => {
    if (editing === 'new') await adminChallengeApi.mastersCategoryCreate({ category: payload });
    else await adminChallengeApi.mastersCategoryUpdate({ id: editing.id, category: payload });
    onReload();
  };

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-bold">Challenge categories</h3>
          <p className="text-sm text-muted-foreground">{categories.length} categories. Keys are stored on challenges — rename labels freely, avoid changing keys.</p>
        </div>
        <Button size="sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add category</Button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Key</th>
              <th className="py-2 pr-3">Active</th>
              <th className="py-2 pr-3">Sort</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-border/50">
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-2">
                    {c.image_url && <img src={c.image_url} alt="" className="h-8 w-12 rounded object-cover" />}
                    <span className="font-medium">{c.label}</span>
                  </span>
                </td>
                <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{c.key}</td>
                <td className="py-2 pr-3">{c.is_active ? 'Yes' : 'Hidden'}</td>
                <td className="py-2 pr-3">{c.sort_order}</td>
                <td className="py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(c)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && <tr><td colSpan={5} className="py-4 text-muted-foreground">No categories yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <MasterFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add category' : `Edit ${editing?.label || ''}`}
        fields={CATEGORY_FIELDS}
        record={editing === 'new' ? null : editing}
        onSave={save}
      />
      <DeleteMasterDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        label={deleting?.label}
        onConfirm={async () => { await adminChallengeApi.mastersCategoryDelete({ id: deleting.id }); onReload(); }}
      />
    </section>
  );
}