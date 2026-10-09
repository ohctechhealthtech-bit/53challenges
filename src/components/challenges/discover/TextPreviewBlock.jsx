import { CATEGORY_EMOJIS } from './discoverConstants';

// Light-themed preview of a written or non-visual entry, styled like a framed
// quotation. Written entries in this app carry their text on the record as
// work_text, so there is nothing to fetch. The whole box opens the viewer.
export default function TextPreviewBlock({ entry, onView }) {
  const isText = !!entry.work_text;
  const body = isText ? entry.work_text : (entry.description || 'Tap to view this entry');

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onView?.(); }}
      aria-label={`View content: ${entry.title || 'entry'}`}
      className="group relative mt-4 block w-full cursor-pointer overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-br from-[#FDF8F1] via-white to-teal-50/40 text-left shadow-sm transition-all hover:border-orange-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      <div className="h-1 w-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />

      <div className="px-5 py-4 sm:px-6 sm:py-5">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-orange-200 bg-orange-100 text-base">
            {isText ? '✍️' : (CATEGORY_EMOJIS[entry.category] || '✨')}
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-600">
            {isText ? 'Written entry' : 'Entry preview'}
          </p>
        </div>

        <span className="block select-none font-serif text-4xl leading-none text-orange-300/70">“</span>

        <p className="-mt-2 line-clamp-5 whitespace-pre-wrap px-1 font-serif text-base leading-relaxed text-stone-800">
          {body}
        </p>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-300/60 to-transparent" />
          <span className="text-xs font-medium tracking-wide text-orange-600/80">— {entry.creator_name}</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-300/60 to-transparent" />
        </div>

        <p className="mt-3 text-xs font-semibold text-teal-700 opacity-0 transition-opacity group-hover:opacity-100">
          Tap to read the full entry →
        </p>
      </div>
    </button>
  );
}
