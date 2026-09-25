import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Lock, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const FIELDS = [
  { key: 'logo_url', label: 'Your logo URL' },
  { key: 'hero_image_url', label: 'Hero image URL' },
  { key: 'primary_colour_hex', label: 'Primary colour', type: 'color' },
  { key: 'secondary_colour_hex', label: 'Secondary colour', type: 'color' },
  { key: 'hashtag', label: 'Campaign hashtag' },
  { key: 'call_to_action', label: 'Call to action' },
  { key: 'campaign_message', label: 'Campaign message', textarea: true },
];

export default function HostBrandCustomiseForm({ proposal }) {
  const snapshot = proposal.template_version_snapshot || {};
  const brand = snapshot.brand_pack || {};
  const [values, setValues] = useState({ ...brand, ...(proposal.host_brand_overrides || {}) });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const overrides = {};
      for (const f of FIELDS) overrides[f.key] = values[f.key] || '';
      await base44.entities.ChallengeDraft.update(proposal.id, {
        host_brand_overrides: overrides,
        review_status: 'submitted_for_review',
      });
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Could not save your branding.');
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <div className="rounded-2xl border border-success/40 bg-success/10 p-8 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
        <h2 className="mt-3 font-heading text-xl font-extrabold">Thanks — that's with our team</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We'll review your challenge, confirm the details and get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-heading text-xl font-extrabold">{snapshot.template_name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The rules, eligibility and judging for this challenge are already set by us. Just add your branding.
      </p>

      <p className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-white/5 p-3 text-xs text-muted-foreground">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Challenge rules, eligibility and judging are locked to keep every challenge fair and compliant.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className={`block ${f.textarea ? 'md:col-span-2' : ''}`}>
            <span className="text-sm font-semibold">{f.label}</span>
            {f.textarea ? (
              <textarea rows={3} className="c53-input mt-1.5" value={values[f.key] || ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
            ) : f.type === 'color' ? (
              <div className="mt-1.5 flex items-center gap-2">
                <input type="color" aria-label={f.label} className="h-10 w-12 rounded-lg border border-border bg-transparent" value={values[f.key] || '#1677C8'} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                <input className="c53-input" value={values[f.key] || ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              </div>
            ) : (
              <input className="c53-input mt-1.5" value={values[f.key] || ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
            )}
          </label>
        ))}
      </div>

      {brand.legal_footer && (
        <p className="mt-4 rounded-xl border border-border bg-white/5 p-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Legal footer (set by 53 Challenges):</span> {brand.legal_footer}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}

      <Button type="submit" className="mt-6" disabled={busy}>Send for review</Button>
    </form>
  );
}