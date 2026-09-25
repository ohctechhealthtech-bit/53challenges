import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { STATUS_TONE, TIERS, titleCase } from './sponsorsMeta';
import EnquiryDetails from './EnquiryDetails';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

// Enquiry detail with the two things you can do with it: reply, or decide.
export default function EnquiryDialog({ enquiry, tiers = TIERS, actingEmail, onClose, onChanged }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [tier, setTier] = useState(enquiry?.suggested_tier || 'gold');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState({ subject: '', body: '' });

  const act = async (kind, fn) => {
    setBusy(kind);
    setError('');
    try { await fn(); onChanged(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const approve = () => act('approve', () =>
    adminChallengeApi.decideSponsorApplication({ id: enquiry.id, decision: 'approve', tier, actingEmail }));

  const reject = () => {
    if (!reason.trim()) { setError('Give a reason so they know why.'); return; }
    return act('reject', () =>
      adminChallengeApi.decideSponsorApplication({ id: enquiry.id, decision: 'reject', reason: reason.trim(), actingEmail }));
  };

  const send = () => {
    if (!message.subject.trim() || !message.body.trim()) { setError('Add a subject and a message.'); return; }
    return act('contact', () =>
      adminChallengeApi.contactSponsorApplication({ id: enquiry.id, subject: message.subject.trim(), message: message.body.trim(), actingEmail }));
  };

  const a = enquiry || {};

  return (
    <Dialog open={Boolean(enquiry)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{a.organisation_name || a.name || 'Sponsor enquiry'}</DialogTitle>
        </DialogHeader>

        {(
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[a.status] || 'bg-muted text-muted-foreground'}`}>
                {titleCase(a.status)}
              </span>
              <span className="text-muted-foreground">{a.contact_name} · {a.contact_email}</span>
            </div>

            <EnquiryDetails a={a} />

            <section className="rounded-xl border border-border p-4">
              <p className="text-sm font-semibold">Reply to them</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label htmlFor="eq-subject" className="mb-1.5 block text-sm">Subject</label>
                  <input id="eq-subject" className="c53-input" value={message.subject} onChange={(e) => { setMessage((p) => ({ ...p, subject: e.target.value })); setError(''); }} />
                </div>
                <div>
                  <label htmlFor="eq-body" className="mb-1.5 block text-sm">Message</label>
                  <textarea id="eq-body" rows={4} className="c53-input" value={message.body} onChange={(e) => { setMessage((p) => ({ ...p, body: e.target.value })); setError(''); }} />
                </div>
                <Button variant="outline" onClick={send} disabled={busy === 'contact'}>{busy === 'contact' ? 'Sending…' : 'Send reply'}</Button>
              </div>
            </section>

            <section className="rounded-xl border border-border p-4">
              <p className="text-sm font-semibold">Decide</p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="w-[180px]">
                  <label htmlFor="eq-tier" className="mb-1.5 block text-sm">Tier if approved</label>
                  <select id="eq-tier" className="c53-input" value={tier} onChange={(e) => setTier(e.target.value)}>
                    {tiers.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
                  </select>
                </div>
                <Button onClick={approve} disabled={busy === 'approve'}>{busy === 'approve' ? 'Approving…' : 'Approve as sponsor'}</Button>
              </div>
              <div className="mt-4">
                <label htmlFor="eq-reason" className="mb-1.5 block text-sm">Reason for saying no</label>
                <textarea id="eq-reason" rows={2} className="c53-input" value={reason} onChange={(e) => { setReason(e.target.value); setError(''); }} />
                <Button variant="outline" className="mt-3" onClick={reject} disabled={busy === 'reject'}>{busy === 'reject' ? 'Rejecting…' : 'Reject enquiry'}</Button>
              </div>
            </section>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}