import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EntryMediaPreview from './EntryMediaPreview';

/** Full-size preview of one submission's work. */
export default function EntryPreviewDialog({ entry, open, onClose }) {
  if (!entry) return null;
  const url = entry.work_url || entry.external_link || entry.work_link || entry.thumbnail_url || '';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{entry.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {entry.creator_name} · {entry.challenge_title}
        </p>
        {entry.description && <p className="text-sm">{entry.description}</p>}
        {entry.work_text && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{entry.work_text}</p>}

        <EntryMediaPreview entry={entry} url={url} />
      </DialogContent>
    </Dialog>
  );
}