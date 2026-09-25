import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { pricingCalculator } from '@/lib/pricingCalculator';
import { WINNER_MODES, ADDONS, PROGRAM_SCOPES } from '@/lib/pricingEngine';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';

function blankRC() {
  return {
    version: 0,
    tier_base_fees: {},
    participants_included: {},
    per_extra_100: {},
    weeks_included: {},
    per_extra_week: {},
    judging_fees: {},
    permit_assistance_fee: 0,
    prize_admin_pct: 0,
    addon_fees: {},
    program_discounts: {},
    gst_pct: 10,
  };
}

export default function RateCardAdmin() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [rc, setRc] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [versions, setVersions] = useState([]);
  const [changeNote, setChangeNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      if (user.role !== 'admin' && !user.is_admin) {
        setForbidden(true);
        return;
      }
      const [active, vers] = await Promise.all([
        pricingCalculator.getActiveRateCard(),
        pricingCalculator.listRateCards(),
      ]);
      setRc(active.rate_card || blankRC());
      setTiers(active.service_tiers || []);
      setVersions(vers.rate_cards || []);
    } catch (e) {
      alert(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  if (loading)
    return (
      <div className="container-tight flex items-center gap-2 py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  if (forbidden) return <div className="container-tight py-8 text-sm text-muted-foreground">Admin access required.</div>;

  const setMap = (field, key, val) =>
    setRc((r) => ({ ...r, [field]: { ...(r[field] || {}), [key]: Number(val) || 0 } }));
  const setNum = (field, val) => setRc((r) => ({ ...r, [field]: Number(val) || 0 }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await pricingCalculator.saveRateCard({ ...rc, change_note: changeNote });
      setChangeNote('');
      await load();
    } catch (e) {
      alert(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-tight py-8">
      <h1 className="font-heading text-3xl font-extrabold">Rate Card Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Editing the active rate card creates a new version. Saved quotes keep their original figures via their stored version.
      </p>

      <Section title="Tier base fees & inclusions">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3">Tier</th>
                <th className="pb-2 px-2">Base fee</th>
                <th className="pb-2 px-2">Pax included</th>
                <th className="pb-2 px-2">Per extra 100</th>
                <th className="pb-2 px-2">Weeks included</th>
                <th className="pb-2 px-2">Per extra week</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="py-2 pr-3 font-medium">{t.name}</td>
                  <td className="py-2 px-2"><NumInput value={rc.tier_base_fees?.[t.id] || 0} onChange={(v) => setMap('tier_base_fees', t.id, v)} /></td>
                  <td className="py-2 px-2"><NumInput value={rc.participants_included?.[t.id] || 0} onChange={(v) => setMap('participants_included', t.id, v)} /></td>
                  <td className="py-2 px-2"><NumInput value={rc.per_extra_100?.[t.id] || 0} onChange={(v) => setMap('per_extra_100', t.id, v)} /></td>
                  <td className="py-2 px-2"><NumInput value={rc.weeks_included?.[t.id] || 0} onChange={(v) => setMap('weeks_included', t.id, v)} /></td>
                  <td className="py-2 px-2"><NumInput value={rc.per_extra_week?.[t.id] || 0} onChange={(v) => setMap('per_extra_week', t.id, v)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Judging fees">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {WINNER_MODES.map((w) => (
            <div key={w.key}>
              <label className="text-xs text-muted-foreground">{w.label}</label>
              <NumInput value={rc.judging_fees?.[w.key] || 0} onChange={(v) => setMap('judging_fees', w.key, v)} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Other fees & tax">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs text-muted-foreground">Permit assistance fee</label>
            <NumInput value={rc.permit_assistance_fee || 0} onChange={(v) => setNum('permit_assistance_fee', v)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Prize admin (%)</label>
            <NumInput value={rc.prize_admin_pct || 0} onChange={(v) => setNum('prize_admin_pct', v)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">GST (%)</label>
            <NumInput value={rc.gst_pct || 0} onChange={(v) => setNum('gst_pct', v)} />
          </div>
        </div>
      </Section>

      <Section title="Add-on fees">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ADDONS.map((a) => (
            <div key={a.key}>
              <label className="text-xs text-muted-foreground">{a.label}</label>
              <NumInput value={rc.addon_fees?.[a.key] || 0} onChange={(v) => setMap('addon_fees', a.key, v)} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Program discounts (%)">
        <div className="grid grid-cols-2 gap-3">
          {PROGRAM_SCOPES.filter((s) => s.discountKey).map((s) => (
            <div key={s.key}>
              <label className="text-xs text-muted-foreground">{s.label}</label>
              <NumInput value={rc.program_discounts?.[s.discountKey] || 0} onChange={(v) => setMap('program_discounts', s.discountKey, v)} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Save new version">
        <input
          className="c53-input"
          placeholder="Change note (e.g. increased base fees)"
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
        />
        <Button className="mt-3" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
          Save as new version (v{(rc.version || 0) + 1})
        </Button>
      </Section>

      <Section title="All versions">
        <ul className="space-y-1 text-sm">
          {versions.map((v) => (
            <li key={v.id} className="flex justify-between">
              <span>
                v{v.version}
                {v.change_note && <span className="text-muted-foreground"> — {v.change_note}</span>}
              </span>
              <span className={v.is_active ? 'text-emerald-400' : 'text-muted-foreground'}>
                {v.is_active ? 'Active' : 'Historical'}
              </span>
            </li>
          ))}
          {versions.length === 0 && <li className="text-muted-foreground">No versions yet.</li>}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4">
      <h2 className="font-heading text-sm font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function NumInput({ value, onChange }) {
  return (
    <input
      type="number"
      className="c53-input w-32"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}