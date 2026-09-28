import { safeExternalUrl } from '@/lib/safeUrl';
import { useState } from 'react';
import { Globe, Mail, MapPin, Wand2, Loader2, Check, Copy, UserPlus } from 'lucide-react';
import { aiGenerateInvite, savePartnerProspect } from '@/lib/marketing';


// A prospect's website, which an AI suggested and nobody has checked. The
// bare value is tried first so an https:// address keeps its scheme; a bare
// domain gets one added. Anything that is not http(s) returns null and the
// anchor renders without an href rather than as a live link.
function prospectWebsite(value) {
  return safeExternalUrl(value) || safeExternalUrl(`https://${value}`);
}
export default function ProspectCard({ prospect, partnerKind }) {
  const [invite, setInvite] = useState(null);
  const [busy, setBusy] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const draft = async () => {
    setBusy('invite'); setError('');
    try {
      const r = await aiGenerateInvite({
        name: prospect.name, location: prospect.location,
        why_fit: prospect.why_fit, angle: prospect.angle, partner_kind: partnerKind,
      });
      setInvite(r);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not draft the invite.');
    }
    setBusy('');
  };

  const addToPipeline = async () => {
    setBusy('save'); setError('');
    try {
      await savePartnerProspect({ ...prospect, kind: prospect.kind || partnerKind });
      setSaved(true);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not add to the pipeline.');
    }
    setBusy('');
  };

  const copyInvite = async () => {
    await navigator.clipboard.writeText(`Subject: ${invite.subject}\n\n${invite.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-bold">{prospect.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {prospect.kind && <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{prospect.kind}</span>}
            {prospect.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {prospect.location}</span>}
            {prospect.website && <a href={prospectWebsite(prospect.website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground"><Globe className="h-3 w-3" /> {prospect.website}</a>}
            {prospect.contact_email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {prospect.contact_email}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={draft} disabled={busy === 'invite'} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-muted disabled:opacity-60">
            {busy === 'invite' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} {invite ? 'Redraft invite' : 'Generate invite'}
          </button>
          <button onClick={addToPipeline} disabled={busy === 'save' || saved} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-muted disabled:opacity-60">
            {saved ? <Check className="h-3.5 w-3.5" /> : busy === 'save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} {saved ? 'In pipeline' : 'Add to outreach'}
          </button>
        </div>
      </div>

      {prospect.why_fit && <p className="mt-3 text-sm text-muted-foreground">{prospect.why_fit}</p>}
      {prospect.angle && <p className="mt-2 text-sm"><span className="font-semibold">Angle:</span> {prospect.angle}</p>}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {invite && (
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject</p>
          <p className="mt-1 font-semibold">{invite.subject}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{invite.body}</p>
          <button onClick={copyInvite} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-muted">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy invite'}
          </button>
        </div>
      )}
    </div>
  );
}