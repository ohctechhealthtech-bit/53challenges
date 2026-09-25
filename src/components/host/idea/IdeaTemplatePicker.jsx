/**
 * Optional shortcut on the idea step — start from one of our existing,
 * ready-to-run challenge templates (same library as host-a-challenge).
 */
import { useEffect, useState } from 'react';
import { Check, Clock, Loader2, PenLine, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { templateThumb } from '@/components/host/idea/templateThumb';

export default function IdeaTemplatePicker({ selectedId, onSelect, onCustom }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions
      .invoke('hostChallengeRequest', { action: 'list_idea_templates' })
      .then((res) => setTemplates(res.data?.templates || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }
  if (!templates.length) return null;

  return (
    <div>
      <p className="mb-1 text-sm font-semibold">Want a head start?</p>
      <p className="mb-2.5 text-xs text-muted-foreground">
        Pick one of our existing, ready-to-run challenges — or describe your own below.
      </p>
      <div className="max-h-72 space-y-2.5 overflow-y-auto rounded-2xl border border-border p-3">
        {templates.map((t) => {
          const selected = selectedId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              className={`flex w-full gap-4 overflow-hidden rounded-xl border p-3 text-left transition ${
                selected ? 'border-2 border-primary bg-blue-50' : 'border-border bg-card hover:border-primary/50'
              }`}
            >
              <Image
                src={templateThumb(t)}
                alt=""
                className="h-24 w-32 shrink-0 rounded-lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold">{t.template_name}</p>
                  {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </div>
                {t.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.summary}</p>}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {t.entry_type && (
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {t.entry_type.replace(/_/g, ' ')}</span>
                  )}
                  {t.recommended_duration_weeks && (
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> about {t.recommended_duration_weeks} weeks</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {selectedId && (
        <button
          type="button"
          onClick={onCustom}
          className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <PenLine className="h-3.5 w-3.5" /> Never mind — I&rsquo;ll describe my own idea
        </button>
      )}
    </div>
  );
}