/**
 * Ranked shortlist of matching challenges — image cards with the key details,
 * plus an always-available "write my own" option.
 */
import { Loader2, Check, Clock, Users, PenLine, Star, Tag, Trophy } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { templateThumb } from '@/components/host/idea/templateThumb';

const pretty = (v) => String(v || '').replace(/[_-]/g, ' ');

export default function TemplateShortlist({ templates, loading, error, selectedId, onSelect, onCustom }) {
  if (loading) {
    return (
      <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-muted-foreground">{error}</p>}

      {templates.map((t, i) => {
        const selected = selectedId === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            className={`block w-full overflow-hidden rounded-2xl border text-left transition ${
              selected
                ? 'border-2 border-[#1677C8] bg-blue-50 shadow-md'
                : 'border-border bg-card hover:border-primary/50 hover:shadow-sm'
            }`}
          >
            <div className="flex flex-col sm:flex-row">
              <div className="relative h-40 w-full shrink-0 sm:h-auto sm:w-48">
                <Image
                  src={templateThumb(t)}
                  alt={t.template_name}
                  className="h-full w-full"
                  fittingType="fill"
                />
                {i === 0 && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-[#1677C8] shadow-sm">
                    <Star className="h-3.5 w-3.5" /> Best match
                  </span>
                )}
              </div>

              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-heading text-base font-bold text-[#102A43]">{t.template_name}</p>
                  {selected && <Check className="h-5 w-5 shrink-0 text-[#1677C8]" />}
                </div>
                {t.summary && <p className="mt-1 text-sm text-slate-600">{t.summary}</p>}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  {t.entry_type && (
                    <span className="inline-flex items-center gap-1 capitalize">
                      <Users className="h-3.5 w-3.5" /> {pretty(t.entry_type)} entries
                    </span>
                  )}
                  {t.recommended_duration_weeks && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> about {t.recommended_duration_weeks} weeks
                    </span>
                  )}
                  {t.category && (
                    <span className="inline-flex items-center gap-1 capitalize">
                      <Tag className="h-3.5 w-3.5" /> {pretty(t.category)}
                    </span>
                  )}
                  {t.winner_method && (
                    <span className="inline-flex items-center gap-1 capitalize">
                      <Trophy className="h-3.5 w-3.5" /> {pretty(t.winner_method)}
                    </span>
                  )}
                </div>
                <span className={`mt-4 inline-block text-sm font-semibold ${selected ? 'text-[#1677C8]' : 'text-primary'}`}>
                  {selected ? 'Selected' : 'Choose this challenge'}
                </span>
              </div>
            </div>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onCustom}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border p-5 text-left text-sm transition hover:border-primary/50"
      >
        <PenLine className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>
          <span className="block font-semibold text-[#102A43]">None of these — I'll describe my own challenge</span>
          <span className="block text-muted-foreground">
            Give us your title and a short description, and we'll build it for you.
          </span>
        </span>
      </button>
    </div>
  );
}