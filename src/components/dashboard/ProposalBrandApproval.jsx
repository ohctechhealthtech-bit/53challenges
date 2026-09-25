/**
 * Admin review of a template-based proposal: locked template rules on one side,
 * the host's branding on the other, with admin-managed fields editable before
 * the proposal is locked and approved.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Lock, CheckCircle2 } from 'lucide-react';
import { templateLibrary } from '@/lib/templateLibrary';

export default function ProposalBrandApproval({ proposal, onApproved }) {
  const snap = proposal.template_version_snapshot || {};
  const brand = snap.brand_pack || {};
  const host = proposal.host_brand_overrides || {};
  const [adjust, setAdjust] = useState({
    legal_footer: proposal.admin_brand_adjustments?.legal_footer ?? brand.legal_footer ?? '',
    campaign_message: proposal.admin_brand_adjustments?.campaign_message ?? host.campaign_message ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!proposal.template_id) return null;

  const approve = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await templateLibrary.approveProposal(proposal.id, adjust);
      onApproved?.(res.proposal);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 rounded-xl border border-border bg-white/5 p-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Lock className="h-3.5 w-3.5" /> From template {snap.template_name} v{snap.template_version}
      </p>

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Winner selection</dt><dd className="font-semibold">{snap.rules_pack?.winner_selection_method || '—'}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Age groups</dt><dd className="font-semibold">{(snap.rules_pack?.age_groups || []).join(', ') || '—'}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">AI policy</dt><dd className="font-semibold">{snap.rules_pack?.ai_use_policy || '—'}</dd></div>
      </dl>

      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Host branding</p>
      <dl className="mt-2 space-y-1 text-sm">
        {['logo_url', 'hero_image_url', 'primary_colour_hex', 'secondary_colour_hex', 'hashtag', 'call_to_action'].map((k) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{k.replace(/_/g, ' ')}</dt>
            <dd className="truncate font-semibold">{host[k] || '—'}</dd>
          </div>
        ))}
      </dl>

      {proposal.approval_locked ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4" /> Locked and approved by {proposal.approved_by}
        </p>
      ) : (
        <>
          <label className="mt-4 block">
            <span className="text-sm font-semibold">Campaign message (you can adjust)</span>
            <textarea rows={2} className="c53-input mt-1.5" value={adjust.campaign_message} onChange={(e) => setAdjust({ ...adjust, campaign_message: e.target.value })} />
          </label>
          <label className="mt-3 block">
            <span className="text-sm font-semibold">Legal footer (admin managed)</span>
            <textarea rows={2} className="c53-input mt-1.5" value={adjust.legal_footer} onChange={(e) => setAdjust({ ...adjust, legal_footer: e.target.value })} />
          </label>
          {error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}
          <Button className="mt-4" onClick={approve} disabled={busy}>Lock &amp; approve</Button>
        </>
      )}
    </div>
  );
}