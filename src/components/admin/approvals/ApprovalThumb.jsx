import { FileText, Video, Image as ImageIcon, Link2 } from 'lucide-react';
import { Image } from '@/components/ui/image';

const ICONS = { video: Video, image: ImageIcon, photo: ImageIcon, text: FileText, link: Link2 };

export default function ApprovalThumb({ row }) {
  const src = row.thumbnail_url || (['image', 'photo'].includes(row.media_type) ? row.work_url : '');
  if (src) {
    return <Image src={src} alt="" className="h-20 w-28 shrink-0 rounded-lg border border-border" />;
  }
  const Icon = ICONS[row.media_type] || ICONS[row.entry_type] || FileText;
  return (
    <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
      <Icon className="h-6 w-6 text-muted-foreground" />
    </div>
  );
}