import { BookOpen } from 'lucide-react';

const SERIF = 'Georgia, "Times New Roman", "Iowan Old Style", ui-serif, serif';

/**
 * Full "written entry" presentation for the lightbox — a paper-like card
 * with a bright orange top border, a WRITTEN ENTRY header, large decorative
 * quote marks around the body, and an author attribution line.
 */
export default function WrittenEntryCard({ entry, className = '' }) {
  const body = entry?.work_text || entry?.description || entry?.title || '';
  const author = entry?.creator_name || 'Anonymous';

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-xl ${className}`}
      style={{
        borderTop: '3px solid #FF8C00',
        background: 'linear-gradient(135deg, #FBF6EE 0%, #F5E9D4 45%, #EFD9BA 100%)',
      }}
    >
      {/* soft warm glows */}
      <div
        className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(255,140,0,0.18), transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(204,122,41,0.16), transparent 70%)' }}
      />

      {/* Header */}
      <div className="relative flex items-center gap-2.5 px-5 pt-4 sm:px-9 sm:pt-7">
        <div className="grid h-8 w-8 place-items-center rounded-lg sm:h-9 sm:w-9" style={{ background: 'rgba(255,140,0,0.15)' }}>
          <BookOpen className="h-4 w-4 text-[#CC7A29] sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#CC7A29] sm:text-[11px]">Written Entry</p>
          <p className="truncate font-serif text-xs font-semibold text-[#2a2230] sm:text-sm" style={{ fontFamily: SERIF }}>{entry?.title}</p>
        </div>
      </div>

      {/* Body */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-3 sm:px-12 sm:py-6">
        <span
          className="pointer-events-none absolute left-4 top-0 font-serif leading-none text-[#CC7A29]/40 sm:left-7 sm:top-2"
          style={{ fontFamily: SERIF, fontSize: 'clamp(2.5rem, 12vw, 5rem)' }}
        >
          “
        </span>
        <p
          className="max-w-xl whitespace-pre-wrap text-center font-serif text-[#2a2230]"
          style={{ fontFamily: SERIF, lineHeight: 1.7, fontSize: 'clamp(0.8rem, 2.6vw, 1.15rem)' }}
        >
          {body}
        </p>
        <span
          className="pointer-events-none absolute bottom-0 right-5 font-serif leading-none text-[#CC7A29]/40 sm:right-8"
          style={{ fontFamily: SERIF, fontSize: 'clamp(2.5rem, 12vw, 5rem)' }}
        >
          ”
        </span>
      </div>

      {/* Footer attribution */}
      <div className="relative px-5 pb-4 sm:px-9 sm:pb-7">
        <div className="mb-1.5 h-px w-full sm:mb-2" style={{ background: 'rgba(204,122,41,0.45)' }} />
        <p className="text-center font-serif text-[#CC7A29] sm:text-base" style={{ fontFamily: SERIF, fontSize: 'clamp(0.7rem, 2.4vw, 1rem)' }}>— {author}</p>
      </div>
    </div>
  );
}