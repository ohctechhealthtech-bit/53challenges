import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import AdAssetsEditor from './AdAssetsEditor';
import { TIERS, titleCase } from './sponsorsMeta';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

const EMPTY = {
  name: '', tier: 'gold', logo_url: '', website_url: '', description: '', season: '',
  contact_name: '', contact_email: '', contribution_amount: '', is_active: true, sort_order: '',
};

export default function SponsorFormDialog({ open, sponsor, tiers = TIERS, adTypes, actingEmail, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [assets, setAssets] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = Boolean(sponsor?.id);
  const set = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setError(''); };

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm({ ...EMPTY, ...(sponsor || {}), contribution_amount: sponsor?.contribution_amount ?? '', sort_order: sponsor?.sort_order ?? '' });
    setAssets(sponsor?.ad_assets ? sponsor.ad_assets.map((a) => ({ ...a })) : []);
  }, [open, sponsor]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Give the sponsor a name.'); return; }
    if (assets.some((a) => !String(a.title || '').trim())) { setError('Every ad or offer needs a title.'); return; }

    const payload = {
      name: form.name.trim(),
      tier: form.tier,
      logo_url: form.logo_url.trim(),
      website_url: form.website_url.trim(),
      description: form.description.trim(),
      season: form.season.trim(),
      contact_name: form.contact_name.trim(),
      contact_email: form.contact_email.trim(),
      is_active: form.is_active !== false,
      ad_assets: assets,
    };
    if (String(form.contribution_amount).trim() !== '') payload.contribution_amount = Number(form.contribution_amount);
    if (String(form.sort_order).trim() !== '') payload.sort_order = Number(form.sort_order);

    setSaving(true);
    setError('');
    try {
      if (editing) await adminChallengeApi.updateSponsor({ id: sponsor.id, sponsor: payload, actingEmail });
      else await adminChallengeApi.createSponsor({ sponsor: payload, actingEmail });
      onSaved();
    } catch (err) {
      setError(err.message.includes('DUPLICATE') ? 'A sponsor with that name already exists.' : err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit sponsor' : 'Add a sponsor'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="sf-name" className="mb-1.5 block text-sm font-semibold">Sponsor name</label>
              <input id="sf-name" className="c53-input" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sf-tier" className="mb-1.5 block text-sm font-semibold">Tier</label>
              <select id="sf-tier" className="c53-input" value={form.tier} onChange={(e) => set('tier', e.target.value)}>
                {tiers.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sf-contact" className="mb-1.5 block text-sm font-semibold">Contact name</label>
              <input id="sf-contact" className="c53-input" value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sf-email" className="mb-1.5 block text-sm font-semibold">Contact email</label>
              <input id="sf-email" className="c53-input" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sf-website" className="mb-1.5 block text-sm font-semibold">Website</label>
              <input id="sf-website" className="c53-input" value={form.website_url} onChange={(e) => set('website_url', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sf-logo" className="mb-1.5 block text-sm font-semibold">Logo link</label>
              <input id="sf-logo" className="c53-input" value={form.logo_url} onChange={(e) => set('logo_url', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sf-season" className="mb-1.5 block text-sm font-semibold">Season</label>
              <input id="sf-season" className="c53-input" value={form.season} onChange={(e) => set('season', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sf-amount" className="mb-1.5 block text-sm font-semibold">Contribution (AUD)</label>
              <input id="sf-amount" className="c53-input" inputMode="decimal" value={form.contribution_amount} onChange={(e) => set('contribution_amount', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sf-order" className="mb-1.5 block text-sm font-semibold">Order within tier</label>
              <input id="sf-order" className="c53-input" inputMode="numeric" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={form.is_active !== false} onChange={(e) => set('is_active', e.target.checked)} />
                Show on the challenge pages
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="sf-desc" className="mb-1.5 block text-sm font-semibold">Short description</label>
            <textarea id="sf-desc" rows={3} className="c53-input" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          <AdAssetsEditor assets={assets} onChange={setAssets} types={adTypes} />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save sponsor' : 'Add sponsor'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}