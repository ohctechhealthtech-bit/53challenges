import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import MasterFormDialog from './MasterFormDialog';
import DeleteMasterDialog from './DeleteMasterDialog';
import { SERVICE_FIELDS } from './mastersMeta';

// Optional host service add-ons offered in the apply wizard.
export default function ServicesPanel({ services, onReload }) {
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const addService = async () => {
    setBusy(true);
    setError('');
    try { await adminChallengeApi.mastersServiceCreate(); onReload(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-bold">Service add-ons</h3>
          <p className="text-sm text-muted-foreground">{services.length} add-ons hosts can buy in the apply wizard.</p>
        </div>
        <Button size="sm" disabled={busy} onClick={addService}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add service
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3">Service</th>
              <th className="py-2 pr-3">Price</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Queue</th>
              <th className="py-2 pr-3">Active</th>
              <th className="py-2 pr-3">Sort</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-b border-border/50">
                <td className="py-2 pr-3 font-medium">{s.name || 'Untitled service'}</td>
                <td className="py-2 pr-3">{typeof s.price === 'number' ? `$${s.price}` : s.price}{s.price_note ? ` · ${s.price_note}` : ''}</td>
                <td className="py-2 pr-3">{s.category}</td>
                <td className="py-2 pr-3">{s.queue}</td>
                <td className="py-2 pr-3">{s.is_active ? 'Yes' : 'Hidden'}</td>
                <td className="py-2 pr-3">{s.sort_order}</td>
                <td className="py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(s)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {services.length === 0 && <tr><td colSpan={7} className="py-4 text-muted-foreground">No service add-ons yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <MasterFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.name || 'service'}`}
        fields={SERVICE_FIELDS}
        record={editing}
        onSave={async (payload) => { await adminChallengeApi.mastersServiceUpdate({ id: editing.id, service: payload }); onReload(); }}
      />
      <DeleteMasterDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        label={deleting?.name || 'service'}
        onConfirm={async () => { await adminChallengeApi.mastersServiceDelete({ id: deleting.id }); onReload(); }}
      />
    </section>
  );
}