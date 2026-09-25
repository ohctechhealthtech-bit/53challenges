import { Lock, Unlock } from 'lucide-react';
import { Image } from '@/components/ui/image';

const HOST_EDITABLE = ['logo_url', 'primary_colour_hex', 'secondary_colour_hex', 'hero_image_url', 'campaign_message', 'hashtag', 'call_to_action'];

function LockTag({ hostEditable }) {
  return (
    <span className={`ml-2 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${hostEditable ? 'border-success/40 text-success' : 'border-border text-muted-foreground'}`}>
      {hostEditable ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
      {hostEditable ? 'Host can edit' : 'Admin managed'}
    </span>
  );
}

export default function BrandPackStep({ template, onChange }) {
  const b = template.brand_pack || {};
  const setPack = (patch) => onChange({ brand_pack: { ...b, ...patch } });
  const editable = (f) => HOST_EDITABLE.includes(f);

  return (
    <div className="space-y-5">
      <p className="rounded-xl border border-border bg-white/5 p-3 text-sm text-muted-foreground">
        These are the approved brand defaults. Hosts may only customise the fields marked “Host can edit”.
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold">Logo URL<LockTag hostEditable={editable('logo_url')} /></span>
          <input className="c53-input mt-1.5" value={b.logo_url || ''} onChange={(e) => setPack({ logo_url: e.target.value })} />
          {b.logo_url && <Image src={b.logo_url} alt="Logo preview" className="mt-2 h-16 w-32 rounded-lg border border-border" fittingType="fit" />}
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Hero image URL<LockTag hostEditable={editable('hero_image_url')} /></span>
          <input className="c53-input mt-1.5" value={b.hero_image_url || ''} onChange={(e) => setPack({ hero_image_url: e.target.value })} />
          {b.hero_image_url && <Image src={b.hero_image_url} alt="Hero preview" className="mt-2 h-24 w-full rounded-lg border border-border" />}
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Primary colour<LockTag hostEditable={editable('primary_colour_hex')} /></span>
          <div className="mt-1.5 flex items-center gap-2">
            <input type="color" aria-label="Primary colour picker" className="h-10 w-12 rounded-lg border border-border bg-transparent" value={b.primary_colour_hex || '#1677C8'} onChange={(e) => setPack({ primary_colour_hex: e.target.value })} />
            <input className="c53-input" value={b.primary_colour_hex || ''} onChange={(e) => setPack({ primary_colour_hex: e.target.value })} />
          </div>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Secondary colour<LockTag hostEditable={editable('secondary_colour_hex')} /></span>
          <div className="mt-1.5 flex items-center gap-2">
            <input type="color" aria-label="Secondary colour picker" className="h-10 w-12 rounded-lg border border-border bg-transparent" value={b.secondary_colour_hex || '#102A43'} onChange={(e) => setPack({ secondary_colour_hex: e.target.value })} />
            <input className="c53-input" value={b.secondary_colour_hex || ''} onChange={(e) => setPack({ secondary_colour_hex: e.target.value })} />
          </div>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Hashtag<LockTag hostEditable={editable('hashtag')} /></span>
          <input className="c53-input mt-1.5" placeholder="#MyChallenge" value={b.hashtag || ''} onChange={(e) => setPack({ hashtag: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Call to action<LockTag hostEditable={editable('call_to_action')} /></span>
          <input className="c53-input mt-1.5" value={b.call_to_action || ''} onChange={(e) => setPack({ call_to_action: e.target.value })} />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-semibold">Campaign message<LockTag hostEditable={editable('campaign_message')} /></span>
        <textarea rows={3} className="c53-input mt-1.5" value={b.campaign_message || ''} onChange={(e) => setPack({ campaign_message: e.target.value })} />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Approved social templates<LockTag hostEditable={false} /></span>
        <textarea rows={3} className="c53-input mt-1.5" placeholder="One per line" value={(b.approved_social_templates || []).join('\n')} onChange={(e) => setPack({ approved_social_templates: e.target.value.split('\n').filter(Boolean) })} />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Legal footer<LockTag hostEditable={false} /></span>
        <textarea rows={3} className="c53-input mt-1.5" value={b.legal_footer || ''} onChange={(e) => setPack({ legal_footer: e.target.value })} />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={b.powered_by_attribution !== false} onChange={(e) => setPack({ powered_by_attribution: e.target.checked })} />
        Show “Powered by 53 Challenges” attribution
        <LockTag hostEditable={false} />
      </label>
    </div>
  );
}