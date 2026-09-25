import { useState } from 'react';
import { Loader2, AlertTriangle, Trophy, FileText, Link as LinkIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/appSession';

const FieldError = ({ msg }) => msg ? (
  <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
    <AlertTriangle className="h-3 w-3" /> {msg}
  </p>
) : null;

/** Edit an entry that hasn't been approved yet — mirrors the entry form layout. */
export default function EntryEditDialog({ entry, open, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: entry?.title || '',
    description: entry?.description || '',
    work_text: entry?.work_text || '',
    work_link: entry?.work_link || '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const save = async () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Please enter a submission title';
    if (!form.description.trim()) e.description = 'Please add a short description';
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    setError('');
    try {
      const res = await base44.functions.invoke('submitChallengeEntry', {
        action: 'update',
        entry_id: entry.id,
        patch: form,
        session_token: getSessionToken(),
      });
      if (res.data?.error) { setError(res.data.error); return; }
      onSaved(res.data.entry);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-extrabold">Edit your entry</DialogTitle>
        </DialogHeader>

        {entry?.challenge_title && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
            <Trophy className="h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm font-semibold text-primary">{entry.challenge_title}</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
          </div>
        )}

        <div className="space-y-5 rounded-2xl border border-border bg-secondary/40 p-4 sm:p-5">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Submission details</p>
            <label className="mb-1.5 block text-sm font-semibold">Submission Title *</label>
            <Input
              placeholder="Name your entry"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className={errors.title ? 'border-destructive' : ''}
            />
            <FieldError msg={errors.title} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Short Description *</label>
            <Textarea
              rows={4}
              placeholder="Describe your entry in a few sentences..."
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className={errors.description ? 'border-destructive' : ''}
            />
            <FieldError msg={errors.description} />
          </div>
        </div>

        <div className="space-y-5 rounded-2xl border border-border bg-secondary/40 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your content</p>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4" /> Text Content
            </label>
            <Textarea
              rows={5}
              placeholder="A poem, story, lyrics or any free text..."
              value={form.work_text}
              onChange={(e) => set('work_text', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
              <LinkIcon className="h-4 w-4" /> Link to your work
            </label>
            <Input
              placeholder="Paste portfolio, YouTube, Behance link..."
              value={form.work_link}
              onChange={(e) => set('work_link', e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">Add text content, a link, or both.</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Saving sends your entry back for review before it appears publicly.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save and resubmit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}