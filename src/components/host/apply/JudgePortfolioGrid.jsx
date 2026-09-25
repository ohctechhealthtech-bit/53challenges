/**
 * Portfolio works from a judge's details — images as thumbnails, other types
 * as a typed icon + title. Every card links out.
 */
import { ExternalLink, FileText, Film, Link2, Loader2 } from 'lucide-react';
import { Image } from '@/components/ui/image';

const ICONS = { document: FileText, video: Film, link: Link2 };

export default function JudgePortfolioGrid({ works, loading }) {
  if (loading) return <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Portfolio ({works.length})</p>
      {works.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted-foreground">No portfolio items yet</p>
      ) : (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {works.map((w) => {
            const href = w.external_link || w.file_url;
            const isImage = w.work_type === 'image' && !!w.file_url;
            const Icon = ICONS[w.work_type] || FileText;
            return (
              <a key={w.id} href={href || undefined} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/50">
                {isImage ? (
                  <Image src={w.file_url} alt={w.title || 'Portfolio work'} className="h-36 w-full" fittingType="fill" />
                ) : (
                  <div className="flex h-20 items-center justify-center bg-secondary text-muted-foreground"><Icon className="h-6 w-6" /></div>
                )}
                <div className="p-3">
                  <p className="break-words text-sm font-semibold">{w.title || 'Untitled work'}</p>
                  {w.description && <p className="mt-0.5 text-xs text-muted-foreground">{w.description}</p>}
                  {href && <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary">View <ExternalLink className="h-3 w-3" /></span>}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}