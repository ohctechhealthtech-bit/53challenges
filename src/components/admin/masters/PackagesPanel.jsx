import { useState } from 'react';
import { Plus, Pencil, Trash2, PackagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import MasterFormDialog from './MasterFormDialog';
import DeleteMasterDialog from './DeleteMasterDialog';
import { PACKAGE_FIELDS } from './mastersMeta';

// Host packages shown on the public /host-a-challenge page.
export default function PackagesPanel({ packages, onReload }) {
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const run = async (kind, fn) => {
    setBusy(kind);
    setError('');
    try { await fn(); onReload(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const canSeed = packages.length === 0;

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-bold">Host packages</h3>
          <p className="text-sm text-muted-foreground">{packages.length} packages on the public hosting page.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canSeed || busy === 'seed'}
            title={canSeed ? undefined : 'Seeding only runs when the list is empty.'}
            onClick={() => run('seed', () => adminChallengeApi.mastersPackagesSeedDefaults())}
          >
            {busy === 'seed' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />} Seed default packages
          </Button>
          <Button size="sm" disabled={busy === 'add'} onClick={() => run('add', () => adminChallengeApi.mastersPackageCreate())}>
            {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add package
          </Button>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {packages.map((p) => (
          <div key={p.id} className={`rounded-xl border p-4 ${p.highlighted ? 'border-primary' : 'border-border'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{p.name || 'Untitled package'}</p>
                <p className="text-xs text-muted-foreground">{p.tagline}</p>
              </div>
              <div className="flex shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleting(p)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <p className="mt-2 text-sm font-medium">{p.price}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {p.highlighted && 'Highlighted · '}{p.is_active ? 'Active' : 'Hidden'} · {(p.features || []).length} features · sort {p.sort_order}
            </p>
          </div>
        ))}
        {packages.length === 0 && <p className="text-sm text-muted-foreground">No packages yet — seed the defaults or add one.</p>}
      </div>
      <MasterFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.name || 'package'}`}
        fields={PACKAGE_FIELDS}
        record={editing}
        onSave={async (payload) => { await adminChallengeApi.mastersPackageUpdate({ id: editing.id, package: payload }); onReload(); }}
      />
      <DeleteMasterDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        label={deleting?.name || 'package'}
        onConfirm={async () => { await adminChallengeApi.mastersPackageDelete({ id: deleting.id }); onReload(); }}
      />
    </section>
  );
}