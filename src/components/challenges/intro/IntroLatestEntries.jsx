import { Link } from 'react-router-dom';
import { Heart, ArrowRight, Play, FileText, Music } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { workKind } from '@/components/challenges/discover/EntryWorkMedia';

const YT = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/;

/** A real preview of the entry's own work — photo, video still, or its text. */
function EntryPreview({ entry }) {
  const { kind, url } = workKind(entry);
  const raw = entry.work_url || entry.work_link || '';

  if (kind === 'image') {
    return <Image src={url} alt={entry.title || 'Entry'} className="h-full w-full" />;
  }

  const yt = raw.match(YT);
  if (yt) {
    return (
      <>
        <img src={`https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg`} alt={entry.title || 'Entry'} className="h-full w-full object-cover" />
        <span className="absolute inset-0 grid place-items-center bg-black/25">
          <Play className="h-7 w-7 fill-white text-white" />
        </span>
      </>
    );
  }

  if (kind === 'video') {
    return (
      <>
        <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        <span className="absolute inset-0 grid place-items-center bg-black/25">
          <Play className="h-7 w-7 fill-white text-white" />
        </span>
      </>
    );
  }

  if (kind === 'audio') {
    return (
      <div className="grid h-full w-full place-items-center bg-secondary">
        <Music className="h-7 w-7 text-muted-foreground" />
      </div>
    );
  }

  // Written / link entries — show their actual words.
  const text = entry.work_text || entry.description || raw || '';
  return (
    <div className="h-full w-full overflow-hidden bg-secondary p-3">
      <FileText className="mb-1.5 h-4 w-4 text-muted-foreground" />
      <p className="line-clamp-4 text-[11px] leading-snug text-muted-foreground">{text || 'Written entry'}</p>
    </div>
  );
}

/** Social proof: a preview strip of the newest entries. */
export default function IntroLatestEntries({ challengeId, entries }) {
  if (!entries.length) return null;
  const voteUrl = `/challenges/${challengeId}/vote`;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold">Latest Entries</h2>
          <p className="text-sm text-muted-foreground">See what other creators have made</p>
        </div>
        <Link to={voteUrl} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          View all entries <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {entries.map((e, i) => (
          <Link key={e.id || i} to={voteUrl} className="group overflow-hidden rounded-xl border border-border bg-secondary transition hover:-translate-y-1">
            <div className="relative aspect-[4/3] overflow-hidden">
              <EntryPreview entry={e} />
              {i === 0 && <span className="absolute left-2 top-2 rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">NEW</span>}
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-bold">{e.title || 'Untitled'}</p>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <p className="truncate text-[11px] text-muted-foreground">by {e.creator_name || 'Anonymous'}</p>
                <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                  <Heart className="h-3 w-3" /> {e.vote_count || e.community_votes || 0}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}