import { ArrowRight, Clock, Users } from 'lucide-react';
import { SERVICE_TIERS, ENTRY_TYPES, labelFor } from '@/lib/templateLibrary';

export default function TemplateChoiceCard({ template, onChoose, busy }) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-6 card-lift">
      <span className="inline-flex w-fit items-center rounded-full border border-border px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
        {labelFor(SERVICE_TIERS, template.service_tier)}
      </span>
      <h3 className="mt-3 font-heading text-lg font-extrabold">{template.template_name}</h3>
      {template.primary_category_id && (
        <p className="mt-1 text-sm font-semibold text-primary">{template.primary_category_id}</p>
      )}
      <p className="mt-3 line-clamp-4 flex-1 text-sm text-muted-foreground">{template.summary}</p>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {template.recommended_duration_weeks && (
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {template.recommended_duration_weeks} weeks</span>
        )}
        {template.entry_type && (
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {labelFor(ENTRY_TYPES, template.entry_type)}</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onChoose(template)}
        disabled={busy}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-full grad-bg px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
      >
        Choose this template <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}