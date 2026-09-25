import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AD_TYPES, titleCase } from './sponsorsMeta';

// The sponsor's promotional items shown on challenge pages.
export default function AdAssetsEditor({ assets = [], onChange, types = AD_TYPES }) {
  const set = (i, key, value) => onChange(assets.map((a, idx) => (idx === i ? { ...a, [key]: value } : a)));
  const add = () => onChange([...assets, { type: types[0] || 'banner', title: '', image_url: '', link_url: '' }]);
  const remove = (i) => onChange(assets.filter((_, idx) => idx !== i));

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Ads and offers</p>
        <Button type="button" variant="outline" size="sm" onClick={add}><Plus className="h-4 w-4" /> Add item</Button>
      </div>

      {assets.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nothing to show on the challenge pages yet.</p>}

      <div className="mt-3 space-y-4">
        {assets.map((a, i) => (
          <div key={i} className="rounded-lg border border-border bg-card/40 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`ad-type-${i}`} className="mb-1.5 block text-sm">Kind</label>
                <select id={`ad-type-${i}`} className="c53-input" value={a.type || ''} onChange={(e) => set(i, 'type', e.target.value)}>
                  {types.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`ad-title-${i}`} className="mb-1.5 block text-sm">Title</label>
                <input id={`ad-title-${i}`} className="c53-input" value={a.title || ''} onChange={(e) => set(i, 'title', e.target.value)} />
              </div>
              <div>
                <label htmlFor={`ad-image-${i}`} className="mb-1.5 block text-sm">Image link</label>
                <input id={`ad-image-${i}`} className="c53-input" value={a.image_url || ''} onChange={(e) => set(i, 'image_url', e.target.value)} />
              </div>
              <div>
                <label htmlFor={`ad-link-${i}`} className="mb-1.5 block text-sm">Click-through link</label>
                <input id={`ad-link-${i}`} className="c53-input" value={a.link_url || ''} onChange={(e) => set(i, 'link_url', e.target.value)} />
              </div>
            </div>
            <button type="button" onClick={() => remove(i)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-destructive hover:underline">
              <Trash2 className="h-3.5 w-3.5" /> Remove item
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}