import { useState } from 'react';
import { Check, X, Loader2, Eye, Link as LinkIcon, Film, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/appSession';
import EntryPreviewDialog from './EntryPreviewDialog';

const Tag = ({ children }) => children ? (
  <span className="rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-medium">{children}</span>
) : null;

/** One pending entry: thumbnail, details, and Preview / Approve / Reject actions. */
export default function ContentApprovalCard({ entry, onDecided }) {
  const [busy, setBusy] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const url = entry.thumbnail_url || entry.work_url || '';
  const isImage = /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(url) || entry.media_type === 'image';
  const isVideo = !isImage && (entry.media_type === 'video' || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url));
  const isAudio = !isImage && !isVideo && (entry.media_type === 'audio' || /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(url));
  const link = entry.external_link || entry.work_link || (!isImage && !isVideo && !isAudio ? url : '');

  const decide = async (decision) => {
    setBusy(decision);
    setError('');
    try {
      const res = await base44.functions.invoke('moderateSubmission', {
        action: 'decide', entry_id: entry.id, decision, reason: decision === 'reject' ? note : '',
        session_token: getSessionToken(),
      });
      if (res.data?.error) { setError(res.data.error); return; }
      onDecided(decision);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Could not save this decision.');
    } finally {
      setBusy('');
    }
  };

  const submitted = entry.submitted_at
    ? new Date(entry.submitted_at).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  return (
    <article className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start gap-4">
        {/* Thumbnail */}
        <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-secondary text-muted-foreground">
          {isImage ? (
            <img src={url} alt={entry.title || 'Submission'} className="h-full w-full object-cover" />
          ) : isVideo ? (
            <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
          ) : isAudio ? (
            <div className="text-center"><Music className="mx-auto h-6 w-6" /><span className="text-[10px] font-semibold uppercase">Audio</span></div>
          ) : link ? (
            <div className="text-center"><LinkIcon className="mx-auto h-6 w-6" /><span className="text-[10px] font-semibold uppercase">Link</span></div>
          ) : (
            <Film className="h-6 w-6" />
          )}
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-base font-bold">{entry.title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {entry.creator_name || 'Participant'}{entry.creator_email ? ` · ${entry.creator_email}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entry.challenge_title} · submitted {submitted}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Tag>{entry.category}</Tag>
            <Tag>{entry.state}</Tag>
            <Tag>{entry.division_name || entry.division}</Tag>
          </div>
          {entry.description && <p className="mt-2 text-sm">{entry.description}</p>}
          {entry.work_text && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{entry.work_text}</p>}
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-medium text-primary underline">
              Open link
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-32">
          <Button size="sm" variant="outline" onClick={() => setPreviewing(true)}>
            <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
          </Button>
          <Button size="sm" disabled={!!busy} onClick={() => decide('approve')} className="bg-emerald-600 text-white hover:bg-emerald-700">
            {busy === 'approve' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />} Approve
          </Button>
          <Button size="sm" variant="destructive" disabled={!!busy} onClick={() => setRejecting((v) => !v)}>
            <X className="mr-1.5 h-3.5 w-3.5" /> Reject
          </Button>
        </div>
      </div>

      {rejecting && (
        <div className="mt-3">
          <label className="mb-1.5 block text-sm font-semibold">Reason for rejection *</label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tell the participant what needs changing…" />
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="destructive" disabled={!note.trim() || !!busy} onClick={() => decide('reject')}>
              {busy === 'reject' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Confirm rejection
            </Button>
            <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setRejecting(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      <EntryPreviewDialog entry={entry} open={previewing} onClose={() => setPreviewing(false)} />
    </article>
  );
}